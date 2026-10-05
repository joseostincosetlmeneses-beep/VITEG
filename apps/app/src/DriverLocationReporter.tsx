import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { api } from "./api";

export function DriverLocationReporter({ enabled }: { enabled: boolean }) {
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActiveRouteId(null);
      return;
    }
    let mounted = true;
    const refreshRoute = () => void api.routes()
      .then((routes) => {
        if (!mounted) return;
        const active = routes.find((route) => ["IN_PROGRESS", "PAUSED"].includes(route.status));
        setActiveRouteId(active?._id ?? null);
      })
      .catch(() => undefined);
    refreshRoute();
    const interval = setInterval(refreshRoute, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !activeRouteId) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;
    void Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== "granted" || cancelled) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
        (location) => {
          void api.trackLocation({
            routeId: activeRouteId,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? undefined,
            speed: location.coords.speed ?? undefined,
            heading: location.coords.heading ?? undefined,
            recordedAt: new Date(location.timestamp).toISOString()
          }).catch(() => undefined);
        }
      );
      if (cancelled) subscription.remove();
    });
    return () => { cancelled = true; subscription?.remove(); };
  }, [activeRouteId, enabled]);

  return null;
}
