"use client";

import {
  APILoadingStatus,
  APIProvider,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { Component, useEffect, useState, type ReactNode } from "react";
import { getGoogleMapsClientConfig } from "@/lib/googleMapsConfig";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

class MapErrorBoundary extends Component<
  { onFailure: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function GoogleMapsLoadGuard({
  onFailure,
  children,
}: {
  onFailure: () => void;
  children: ReactNode;
}) {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (
      status === APILoadingStatus.AUTH_FAILURE ||
      status === APILoadingStatus.FAILED
    ) {
      onFailure();
    }
  }, [onFailure, status]);

  if (
    status === APILoadingStatus.NOT_LOADED ||
    status === APILoadingStatus.LOADING
  ) {
    return <div className="map-loading">جاري تحميل الخريطة...</div>;
  }

  return (
    <MapErrorBoundary onFailure={onFailure}>{children}</MapErrorBoundary>
  );
}

/** Try Google Maps; on API/key errors fall back to Carto (any browser). */
export default function GoogleMapsShell({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => setFailed(true);
    return () => {
      window.gm_authFailure = previous;
    };
  }, []);

  if (failed) {
    return <>{fallback}</>;
  }

  const { apiKey } = getGoogleMapsClientConfig();

  return (
    <APIProvider apiKey={apiKey} libraries={["marker"]}>
      <GoogleMapsLoadGuard onFailure={() => setFailed(true)}>
        {children}
      </GoogleMapsLoadGuard>
    </APIProvider>
  );
}
