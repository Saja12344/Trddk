"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { MapLatLng } from "@/components/maps/googleMapUtils";

type TrddkGoogleMarkerProps = {
  position: MapLatLng;
  title?: string;
  draggable?: boolean;
  onDragEnd?: (position: MapLatLng) => void;
  children: ReactNode;
};

/** HTML/CSS map pin — works with JSON map styles (no cloud mapId on the Map). */
export default function TrddkGoogleMarker({
  position,
  title,
  draggable = false,
  onDragEnd,
  children,
}: TrddkGoogleMarkerProps) {
  const map = useMap();
  const rootRef = useRef<Root | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    if (!map) return;
    const mapInstance = map;

    let dragListener: google.maps.MapsEventListener | null = null;
    let upListener: google.maps.MapsEventListener | null = null;
    let dragging = false;

    class HtmlMarker extends google.maps.OverlayView {
      container: HTMLDivElement | null = null;

      onAdd() {
        const container = document.createElement("div");
        container.style.position = "absolute";
        container.style.cursor = draggable ? "grab" : "default";
        if (title) container.title = title;
        this.container = container;

        this.getPanes()?.overlayMouseTarget.appendChild(container);
        rootRef.current = createRoot(container);
        rootRef.current.render(<>{children}</>);

        if (draggable && onDragEnd) {
          container.addEventListener("mousedown", (event) => {
            if (event.button !== 0) return;
            dragging = true;
            container.style.cursor = "grabbing";
            event.preventDefault();
            event.stopPropagation();
          });

          dragListener = mapInstance.addListener(
            "mousemove",
            (event: google.maps.MapMouseEvent) => {
              if (!dragging || !event.latLng) return;
              positionRef.current = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng(),
              };
              overlayRef.current?.draw();
            }
          );

          upListener = mapInstance.addListener("mouseup", (event: google.maps.MapMouseEvent) => {
            if (!dragging || !event.latLng) return;
            dragging = false;
            container.style.cursor = "grab";
            onDragEnd({
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
            });
          });
        }
      }

      draw() {
        if (!this.container) return;
        const point = this.getProjection()?.fromLatLngToDivPixel(
          new google.maps.LatLng(positionRef.current.lat, positionRef.current.lng)
        );
        if (!point) return;
        this.container.style.left = `${point.x}px`;
        this.container.style.top = `${point.y}px`;
        this.container.style.transform = "translate(-50%, -50%)";
      }

      onRemove() {
        dragListener?.remove();
        upListener?.remove();
        dragListener = null;
        upListener = null;
        rootRef.current?.unmount();
        rootRef.current = null;
        this.container?.remove();
        this.container = null;
      }
    }

    const overlay = new HtmlMarker();
    overlay.setMap(mapInstance);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, draggable, title, onDragEnd, children]);

  useEffect(() => {
    overlayRef.current?.draw();
  }, [position.lat, position.lng]);

  useEffect(() => {
    rootRef.current?.render(<>{children}</>);
  }, [children]);

  return null;
}
