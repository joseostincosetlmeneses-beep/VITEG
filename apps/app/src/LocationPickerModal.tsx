import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MapboxPlace } from "./MapboxPlaceSearch";
import { RouteMap, type RouteMapPoint } from "./RouteMap";
import { colors, radius } from "./theme";

export function LocationPickerModal({
  visible,
  title,
  value,
  onChange,
  onClose
}: {
  visible: boolean;
  title: string;
  value: MapboxPlace | null;
  onChange: (place: MapboxPlace) => void;
  onClose: () => void;
}) {
  const points: RouteMapPoint[] = value ? [{
    id: "selected-location",
    label: value.label,
    coordinates: [value.longitude, value.latitude],
    sequence: 0,
    kind: "destination"
  }] : [];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Toca la ubicación exacta del domicilio</Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Cerrar mapa">
            <Ionicons name="close" size={25} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.tip}>
          <Ionicons name="finger-print-outline" size={20} color={colors.blue} />
          <Text style={styles.tipText}>Puedes acercar el mapa y tocar un portón, esquina o edificio aunque no tenga nombre.</Text>
        </View>
        <RouteMap
          points={points}
          fullScreen
          onMapPress={([longitude, latitude]) => onChange({
            label: `Ubicación fijada en mapa · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            latitude,
            longitude
          })}
        />
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedTitle}>{value ? "Ubicación seleccionada" : "Todavía no has fijado la ubicación"}</Text>
            {value && <Text numberOfLines={1} style={styles.selectedText}>{value.label}</Text>}
          </View>
          <Pressable style={[styles.done, !value && styles.doneDisabled]} disabled={!value} onPress={onClose}>
            <Ionicons name="checkmark" size={20} color="white" />
            <Text style={styles.doneText}>Confirmar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.background },
  tip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.softBlue },
  tipText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  footer: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderTopWidth: 1, borderTopColor: colors.border },
  selectedTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  selectedText: { color: colors.muted, fontSize: 10, marginTop: 3 },
  done: { minHeight: 46, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.blue, flexDirection: "row", alignItems: "center", gap: 6 },
  doneDisabled: { opacity: 0.45 },
  doneText: { color: "white", fontSize: 12, fontWeight: "900" }
});
