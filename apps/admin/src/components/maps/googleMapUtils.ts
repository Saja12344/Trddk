import type { LatLngExpression } from "leaflet";

export type MapLatLng = { lat: number; lng: number };

export function toMapLatLng(expr: LatLngExpression): MapLatLng {
  const [lat, lng] = expr as [number, number];
  return { lat, lng };
}

export function toMapLatLngList(exprs: LatLngExpression[]): MapLatLng[] {
  return exprs.map(toMapLatLng);
}
