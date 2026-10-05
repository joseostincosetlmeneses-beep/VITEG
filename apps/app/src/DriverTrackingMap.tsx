import { StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { colors, radius } from "./theme";

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (accessToken) Mapbox.setAccessToken(accessToken);

export function DriverTrackingMap({ locations }: { locations: any[] }) {
  const validLocations = locations.filter((row) => typeof row.latitude === "number" && typeof row.longitude === "number");
  const coordinates = validLocations.map((row) => [row.longitude, row.latitude] as [number, number]);
  const center = coordinates.length
    ? coordinates.reduce<[number, number]>((sum, point) => [sum[0] + point[0] / coordinates.length, sum[1] + point[1] / coordinates.length], [0, 0])
    : [-97.9248, 19.3139] as [number, number];
  const bounds = coordinates.length > 1
    ? coordinates.reduce((value, point) => ({
        ne: [Math.max(value.ne[0], point[0]), Math.max(value.ne[1], point[1])] as [number, number],
        sw: [Math.min(value.sw[0], point[0]), Math.min(value.sw[1], point[1])] as [number, number]
      }), { ne: coordinates[0]!, sw: coordinates[0]! })
    : undefined;
  const shape = {
    type: "FeatureCollection",
    features: validLocations.map((row) => {
      const name = row.driverId ? `${row.driverId.firstName ?? ""} ${row.driverId.lastName ?? ""}`.trim() : "Repartidor";
      const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
      return {
        type: "Feature",
        id: row._id,
        properties: { name, initials },
        geometry: { type: "Point", coordinates: [row.longitude, row.latitude] }
      };
    })
  } as const;

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} logoEnabled attributionEnabled compassEnabled>
        <Mapbox.Camera
          centerCoordinate={bounds ? undefined : center}
          zoomLevel={bounds ? undefined : 13.5}
          bounds={bounds ? { ne: bounds.ne, sw: bounds.sw, paddingTop: 70, paddingRight: 50, paddingBottom: 70, paddingLeft: 50 } : undefined}
          maxZoomLevel={15}
          animationDuration={500}
        />
        {validLocations.length > 0 && (
          <Mapbox.ShapeSource id="driver-live-locations" shape={shape as any}>
            <Mapbox.CircleLayer id="driver-live-circles" style={{ circleRadius: 16, circleColor: colors.blue, circleStrokeColor: "white", circleStrokeWidth: 3 }} />
            <Mapbox.SymbolLayer id="driver-live-initials" style={{ textField: ["get", "initials"] as any, textSize: 11, textColor: "white", textAllowOverlap: true, textIgnorePlacement: true }} />
            <Mapbox.SymbolLayer id="driver-live-names" style={{ textField: ["get", "name"] as any, textSize: 11, textColor: colors.ink, textOffset: [0, 2.25], textHaloColor: "white", textHaloWidth: 2, textAllowOverlap: true }} />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>
      <View style={styles.status}>
        <View style={[styles.liveDot, { backgroundColor: validLocations.length ? colors.green : colors.muted }]} />
        <Text style={styles.statusText}>{validLocations.length ? `${validLocations.length} repartidor${validLocations.length === 1 ? "" : "es"} localizado${validLocations.length === 1 ? "" : "s"}` : "Sin ubicaciones reportadas"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 330, marginTop: 14, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.softBlue },
  map: { flex: 1 },
  status: { position: "absolute", left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.94)", flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: colors.ink, fontSize: 10, fontWeight: "800" }
});
