import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MapboxPlace } from "./MapboxPlaceSearch";
import { RouteMap, type RouteMapPoint } from "./RouteMap";
import { colors, radius } from "./theme";

type PointMode = "origin" | "stop" | "destination";

export function RoutePointPickerModal({
  visible,
  origin,
  destination,
  waypoints,
  onOriginChange,
  onDestinationChange,
  onWaypointsChange,
  onClose
}: {
  visible: boolean;
  origin: MapboxPlace | null;
  destination: MapboxPlace | null;
  waypoints: MapboxPlace[];
  onOriginChange: (place: MapboxPlace | null) => void;
  onDestinationChange: (place: MapboxPlace | null) => void;
  onWaypointsChange: (places: MapboxPlace[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PointMode>("origin");
  const points = useMemo<RouteMapPoint[]>(() => [
    ...(origin ? [{ id: "picker-origin", label: origin.label, coordinates: [origin.longitude, origin.latitude] as [number, number], sequence: 0, kind: "origin" as const }] : []),
    ...waypoints.map((point, index) => ({ id: `picker-stop-${index}`, label: point.label, coordinates: [point.longitude, point.latitude] as [number, number], sequence: index + 1, kind: "stop" as const })),
    ...(destination ? [{ id: "picker-destination", label: destination.label, coordinates: [destination.longitude, destination.latitude] as [number, number], sequence: waypoints.length + 1, kind: "destination" as const }] : [])
  ], [destination, origin, waypoints]);

  const placePoint = ([longitude, latitude]: [number, number]) => {
    if (mode === "stop" && waypoints.length >= 23) {
      Alert.alert("Límite de paradas", "Una ruta puede contener hasta 23 paradas intermedias.");
      return;
    }
    const temporary: MapboxPlace = {
      label: `Punto en mapa · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude
    };
    if (mode === "origin") onOriginChange(temporary);
    if (mode === "destination") onDestinationChange(temporary);
    if (mode === "stop") onWaypointsChange([...waypoints, temporary]);
  };

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= waypoints.length) return;
    const next = [...waypoints];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onWaypointsChange(next);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Fijar puntos en el mapa</Text>
            <Text style={styles.subtitle}>Selecciona un tipo y toca su ubicación exacta</Text>
          </View>
          <Pressable accessibilityLabel="Cerrar selector de puntos" style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={25} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.modeBar}>
          <ModeButton active={mode === "origin"} icon="radio-button-on" label="Origen" color={colors.green} onPress={() => setMode("origin")} />
          <ModeButton active={mode === "stop"} icon="add-circle" label="Parada" color={colors.amber} onPress={() => setMode("stop")} />
          <ModeButton active={mode === "destination"} icon="location" label="Destino" color={colors.red} onPress={() => setMode("destination")} />
        </View>
        <View style={styles.instruction}>
          <Ionicons name="finger-print-outline" size={19} color={colors.blue} />
          <Text style={styles.instructionText}>
            {mode === "stop" ? "Cada toque agrega una nueva parada" : `Toca el mapa para ${mode === "origin" ? "fijar o reemplazar el origen" : "fijar o reemplazar el destino"}`}
          </Text>
        </View>

        <RouteMap points={points} fullScreen onMapPress={placePoint} />

        <View style={styles.sheet}>
          <View style={styles.sheetHeading}>
            <Text style={styles.sheetTitle}>Recorrido</Text>
            <Text style={styles.count}>{waypoints.length} parada{waypoints.length === 1 ? "" : "s"}</Text>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 8 }}>
            <PointRow label={origin?.label ?? "Toca el mapa para definirlo"} title="Origen" color={colors.green} onRemove={origin ? () => onOriginChange(null) : undefined} />
            {waypoints.map((point, index) => (
              <PointRow
                key={`${point.latitude}-${point.longitude}-${index}`}
                label={point.label}
                title={`Parada ${index + 1}`}
                color={colors.amber}
                onUp={index > 0 ? () => moveWaypoint(index, -1) : undefined}
                onDown={index < waypoints.length - 1 ? () => moveWaypoint(index, 1) : undefined}
                onRemove={() => onWaypointsChange(waypoints.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
            <PointRow label={destination?.label ?? "Toca el mapa para definirlo"} title="Destino" color={colors.red} onRemove={destination ? () => onDestinationChange(null) : undefined} />
          </ScrollView>
          <Pressable style={styles.done} onPress={onClose}>
            <Ionicons name="checkmark" size={20} color="white" />
            <Text style={styles.doneText}>Usar estos puntos</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ModeButton({ active, icon, label, color, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.mode, active && { borderColor: color, backgroundColor: `${color}18` }]} onPress={onPress}>
      <Ionicons name={icon} size={19} color={active ? color : colors.muted} />
      <Text style={[styles.modeText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

function PointRow({ title, label, color, onUp, onDown, onRemove }: { title: string; label: string; color: string; onUp?: () => void; onDown?: () => void; onRemove?: () => void }) {
  return (
    <View style={styles.pointRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.pointLabel}>{label}</Text>
      </View>
      {onUp && <Pressable style={styles.smallAction} onPress={onUp}><Ionicons name="arrow-up" size={17} color={colors.blue} /></Pressable>}
      {onDown && <Pressable style={styles.smallAction} onPress={onDown}><Ionicons name="arrow-down" size={17} color={colors.blue} /></Pressable>}
      {onRemove && <Pressable style={styles.smallAction} onPress={onRemove}><Ionicons name="trash-outline" size={17} color={colors.red} /></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modeBar: { flexDirection: "row", gap: 7, padding: 10, backgroundColor: "white" },
  mode: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  instruction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, paddingBottom: 9 },
  instructionText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  sheet: { maxHeight: "38%", padding: 12, backgroundColor: "white", borderTopWidth: 1, borderTopColor: colors.border },
  sheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  count: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  list: { maxHeight: 150 },
  pointRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: "#EDF2F7", paddingVertical: 5 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "white" },
  pointTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  pointLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  smallAction: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.background },
  done: { minHeight: 48, marginTop: 10, borderRadius: radius.sm, backgroundColor: colors.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  doneText: { color: "white", fontSize: 14, fontWeight: "900" }
});
