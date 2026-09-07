import { Router, Request, Response } from "express";
import { COLLECTIONS } from "@tardadi/shared";
import { businessRef } from "../business/helpers";
import { db } from "../firebase";
import { fail, getOrgId, ok } from "../utils";

const router = Router();

type LatLng = { latitude: number; longitude: number };

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function polylineLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

function decodeGoogleEncodedPolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

async function fetchGoogleRoute(
  origin: LatLng,
  destination: LatLng,
  intermediates: LatLng[],
  apiKey: string,
): Promise<{
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
} | null> {
  const body: Record<string, unknown> = {
    origin: {
      location: {
        latLng: { latitude: origin.latitude, longitude: origin.longitude },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    polylineQuality: "OVERVIEW",
    polylineEncoding: "ENCODED_POLYLINE",
    computeAlternativeRoutes: false,
    optimizeWaypointOrder: false,
  };

  if (intermediates.length > 0) {
    body.intermediates = intermediates.map((p) => ({
      location: { latLng: { latitude: p.latitude, longitude: p.longitude } },
    }));
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    console.warn(
      "Google Routes API failed:",
      response.status,
      await response.text(),
    );
    return null;
  }

  const data = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
    }>;
  };

  const route = data.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!encoded) return null;

  const points = decodeGoogleEncodedPolyline(encoded);
  if (points.length < 2) return null;

  let durationSeconds = 0;
  const duration = route?.duration ?? "";
  const match = duration.match(/^(\d+)s$/);
  if (match) durationSeconds = parseInt(match[1], 10);

  return {
    points,
    distanceMeters: route?.distanceMeters ?? polylineLengthMeters(points),
    durationSeconds,
  };
}

async function fetchOsrmRoute(
  origin: LatLng,
  destination: LatLng,
  intermediates: LatLng[],
): Promise<{
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
} | null> {
  const all = [origin, ...intermediates, destination];
  const coords = all.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: number[][] };
      }>;
    };
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!coordinates?.length) return null;

    const points = coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    return {
      points,
      distanceMeters: route?.distance ?? polylineLengthMeters(points),
      durationSeconds: Math.round(route?.duration ?? 0),
    };
  } catch (error) {
    console.warn("OSRM routing failed:", error);
    return null;
  }
}

function fallbackStraightLine(
  origin: LatLng,
  destination: LatLng,
  intermediates: LatLng[],
): { points: LatLng[]; distanceMeters: number; durationSeconds: number } {
  const points = [origin, ...intermediates, destination];
  const distanceMeters = polylineLengthMeters(points);
  const durationSeconds = Math.round((distanceMeters / 1000 / 30) * 3600);
  return { points, distanceMeters, durationSeconds };
}

async function loadStoredPolyline(
  businessId: string,
  routeId: string,
): Promise<number[][] | null> {
  const doc = await businessRef(db, businessId)
    .collection(COLLECTIONS.routes)
    .doc(routeId)
    .get();
  const polyline = doc.data()?.polyline;
  if (!Array.isArray(polyline) || polyline.length < 2) return null;
  return polyline as number[][];
}

router.post("/route", async (req: Request, res: Response) => {
  try {
    const businessId = getOrgId(req);
    const {
      origin,
      destination,
      waypoints = [],
      routeId,
    } = req.body as {
      origin?: LatLng;
      destination?: LatLng;
      waypoints?: LatLng[];
      routeId?: string;
    };

    if (
      origin?.latitude == null ||
      origin?.longitude == null ||
      destination?.latitude == null ||
      destination?.longitude == null
    ) {
      fail(res, "origin and destination are required");
      return;
    }

    const intermediates = (waypoints ?? []).filter(
      (p) => p?.latitude != null && p?.longitude != null,
    );

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      const google = await fetchGoogleRoute(
        origin,
        destination,
        intermediates,
        apiKey,
      );
      if (google) {
        ok(res, {
          points: google.points.map((p) => [p.latitude, p.longitude]),
          distanceMeters: google.distanceMeters,
          durationSeconds: google.durationSeconds,
          estimated: false,
          provider: "google_routes",
        });
        return;
      }
    }

    const osrm = await fetchOsrmRoute(origin, destination, intermediates);
    if (osrm) {
      ok(res, {
        points: osrm.points.map((p) => [p.latitude, p.longitude]),
        distanceMeters: osrm.distanceMeters,
        durationSeconds: osrm.durationSeconds,
        estimated: false,
        provider: "osrm",
      });
      return;
    }

    if (routeId) {
      const stored = await loadStoredPolyline(businessId, routeId);
      if (stored) {
        const points = stored.map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        ok(res, {
          points: stored,
          distanceMeters: polylineLengthMeters(points),
          durationSeconds: Math.round(
            (polylineLengthMeters(points) / 1000 / 30) * 3600,
          ),
          estimated: false,
          provider: "stored",
        });
        return;
      }
    }

    const fallback = fallbackStraightLine(origin, destination, intermediates);
    ok(res, {
      points: fallback.points.map((p) => [p.latitude, p.longitude]),
      distanceMeters: fallback.distanceMeters,
      durationSeconds: fallback.durationSeconds,
      estimated: true,
      provider: "straight_line",
    });
  } catch (error) {
    console.error("Routing error:", error);
    fail(res, "routing_failed", 500);
  }
});

export default router;
