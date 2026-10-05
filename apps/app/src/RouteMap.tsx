import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { colors, radius } from "./theme";

export type RouteMapPoint = {
  id: string;
  label: string;
  coordinates: [number, number];
  sequence?: number;
  kind?: "origin" | "stop" | "destination" | "address";
};

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (accessToken) Mapbox.setAccessToken(accessToken);

export function RouteMap({ points, fullScreen = false }: { points: RouteMapPoint[]; fullScreen?: boolean }) {
  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][]>([]);
  const orderedPoints = useMemo(
    () => [...points].sort((a, b) => (a.sequence ?? 9999) - (b.sequence ?? 9999)),
    [points]
  );

  useEffect(() => {
    if (!accessToken || orderedPoints.length < 2) {
      setRoadCoordinates(orderedPoints.map((point) => point.coordinates));
      return;
    }
    const coordinates = orderedPoints.map((point) => point.coordinates.join(",")).join(";");
    const controller = new AbortController();
    void fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${accessToken}`,
      { signal: controller.signal }
    )
      .then((response) => response.json())
      .then((body) => {
        const next = body.routes?.[0]?.geometry?.coordinates;
        setRoadCoordinates(Array.isArray(next) ? next : orderedPoints.map((point) => point.coordinates));
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setRoadCoordinates(orderedPoints.map((point) => point.coordinates));
        }
      });
    return () => controller.abort();
  }, [orderedPoints]);

  if (!accessToken) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableTitle}>Mapbox no está configurado</Text>
        <Text style={styles.unavailableText}>Agrega el token público en apps/app/.env.</Text>
      </View>
    );
  }

  const center = orderedPoints.length
    ? orderedPoints.reduce<[number, number]>(
        (value, point) => [value[0] + point.coordinates[0] / orderedPoints.length, value[1] + point.coordinates[1] / orderedPoints.length],
        [0, 0]
      )
    : [-97.9248, 19.3139] as [number, number];
  const bounds = orderedPoints.length > 1
    ? orderedPoints.reduce(
        (value, point) => ({
          ne: [Math.max(value.ne[0], point.coordinates[0]), Math.max(value.ne[1], point.coordinates[1])] as [number, number],
          sw: [Math.min(value.sw[0], point.coordinates[0]), Math.min(value.sw[1], point.coordinates[1])] as [number, number]
        }),
        { ne: orderedPoints[0]!.coordinates, sw: orderedPoints[0]!.coordinates }
      )
    : undefined;
  const pointCollection = {
    type: "FeatureCollection",
    features: orderedPoints.map((point) => ({
      type: "Feature",
      id: point.id,
      properties: { label: point.label, sequence: point.sequence ?? "", kind: point.kind ?? "address" },
      geometry: { type: "Point", coordinates: point.coordinates }
    }))
  } as const;
  const line = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: roadCoordinates }
  } as const;

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled
        attributionEnabled
        compassEnabled
        rotateEnabled
      >
        <Mapbox.Camera
          centerCoordinate={bounds ? undefined : center}
          zoomLevel={bounds ? undefined : 13}
          bounds={bounds ? {
            ne: bounds.ne,
            sw: bounds.sw,
            paddingTop: fullScreen ? 90 : 46,
            paddingRight: fullScreen ? 55 : 36,
            paddingBottom: fullScreen ? 110 : 66,
            paddingLeft: fullScreen ? 55 : 36
          } : undefined}
          maxZoomLevel={15}
          animationDuration={500}
        />
        {roadCoordinates.length > 1 && (
          <Mapbox.ShapeSource id="viteg-route-line" shape={line as any}>
            <Mapbox.LineLayer
              id="viteg-route-line-layer"
              style={{ lineColor: colors.blue, lineWidth: 5, lineOpacity: 0.82, lineJoin: "round", lineCap: "round" }}
            />
          </Mapbox.ShapeSource>
        )}
        <Mapbox.ShapeSource id="viteg-route-points" shape={pointCollection as any}>
          <Mapbox.CircleLayer
            id="viteg-route-points-layer"
            style={{
              circleRadius: 8,
              circleColor: [
                "match",
                ["get", "kind"],
                "origin", colors.green,
                "destination", colors.red,
                colors.amber
              ] as any,
              circleStrokeColor: "white",
              circleStrokeWidth: 3
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
      <View style={styles.caption}>
        <Text style={styles.captionText}>
          {orderedPoints.length
            ? fullScreen
              ? `${orderedPoints.length} punto${orderedPoints.length === 1 ? "" : "s"} · desliza y pellizca para explorar`
              : `${orderedPoints.length} punto${orderedPoints.length === 1 ? "" : "s"} en el mapa`
            : "Agrega domicilios a una ruta para trazarla"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.softBlue
  },
  fullScreen: { flex: 1, height: undefined, borderRadius: 0, borderWidth: 0 },
  map: { flex: 1 },
  caption: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    alignItems: "center"
  },
  captionText: {
    color: colors.ink,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden"
  },
  unavailable: {
    height: 240,
    borderRadius: radius.md,
    backgroundColor: colors.softRed,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  unavailableTitle: { color: colors.red, fontWeight: "900", fontSize: 17 },
  unavailableText: { color: colors.muted, marginTop: 6, textAlign: "center" }
});
