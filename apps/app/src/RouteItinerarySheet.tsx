import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";

const COLLAPSED_HEIGHT = 68;
const EXPANDED_HEIGHT = 370;

export function RouteItinerarySheet({ route }: { route: any }) {
  const [expanded, setExpanded] = useState(false);
  const height = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const settledHeight = useRef(COLLAPSED_HEIGHT);
  const waypoints = Array.isArray(route?.waypoints) ? route.waypoints : [];

  const animate = (nextExpanded: boolean) => {
    const next = nextExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
    setExpanded(nextExpanded);
    settledHeight.current = next;
    Animated.spring(height, { toValue: next, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.8 }).start();
  };
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4,
    onPanResponderMove: (_event, gesture) => {
      height.setValue(Math.max(COLLAPSED_HEIGHT, Math.min(EXPANDED_HEIGHT, settledHeight.current - gesture.dy)));
    },
    onPanResponderRelease: (_event, gesture) => {
      const projected = settledHeight.current - gesture.dy - gesture.vy * 45;
      animate(projected > (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2);
    },
    onPanResponderTerminate: () => animate(expanded)
  }), [expanded, height]);

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      <View {...panResponder.panHandlers}>
        <Pressable style={styles.heading} onPress={() => animate(!expanded)}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View>
              <Text style={styles.title}>Recorrido</Text>
              <Text style={styles.hint}>{expanded ? "Desliza hacia abajo para ocultar" : "Desliza hacia arriba para ver las entregas"}</Text>
            </View>
            <View style={styles.headingRight}>
              <Text style={styles.count}>{waypoints.length} parada{waypoints.length === 1 ? "" : "s"}</Text>
              <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={21} color={colors.blue} />
            </View>
          </View>
        </Pressable>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
        <ItineraryRow type="origin" title="Origen" label={route?.origin?.label ?? "Sin origen registrado"} />
        {waypoints.map((point: any, index: number) => (
          <ItineraryRow
            key={`${point.addressId?._id ?? point.addressId ?? point.latitude}-${index}`}
            type="stop"
            title={`Parada ${index + 1}`}
            label={point.label}
            phone={point.customerId?.phone}
            priority={point.priority ?? 0}
            items={point.items ?? []}
          />
        ))}
        <ItineraryRow type="destination" title="Destino" label={route?.destination?.label ?? "Sin destino registrado"} />
      </ScrollView>
    </Animated.View>
  );
}

function ItineraryRow({
  type,
  title,
  label,
  phone,
  priority = 0,
  items = []
}: {
  type: "origin" | "stop" | "destination";
  title: string;
  label: string;
  phone?: string;
  priority?: number;
  items?: any[];
}) {
  const color = type === "origin" ? colors.green : type === "destination" ? colors.red : colors.amber;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{title}</Text>
          {priority >= 90 && <View style={styles.priority}><Ionicons name="snow-outline" size={12} color={colors.red} /><Text style={styles.priorityText}>Prioridad alta</Text></View>}
        </View>
        <Text style={styles.label}>{label}</Text>
        {phone && <Text style={styles.phone}>Tel. {phone}</Text>}
        {items.length > 0 ? (
          <View style={styles.items}>
            {items.map((item, index) => {
              const product = typeof item.productId === "object" ? item.productId : null;
              return (
                <View key={`${product?._id ?? item.productId}-${index}`} style={styles.item}>
                  <Ionicons name={product?.category === "HIELO" ? "snow-outline" : "cube-outline"} size={14} color={product?.category === "HIELO" ? colors.red : colors.blue} />
                  <Text style={styles.itemText}>{item.expectedQuantity} {product?.unit ?? "unidad(es)"} · {product?.name ?? "Producto"}</Text>
                </View>
              );
            })}
          </View>
        ) : type === "stop" ? <Text style={styles.noItems}>Sin productos asignados</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden", backgroundColor: "white", borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: colors.navy, shadowOpacity: 0.2, shadowRadius: 13, shadowOffset: { width: 0, height: -4 }, elevation: 14 },
  heading: { height: COLLAPSED_HEIGHT, paddingHorizontal: 16, paddingTop: 7, paddingBottom: 9 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 7 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 9, marginTop: 2 },
  count: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 15, paddingBottom: 18 },
  row: { minHeight: 58, paddingVertical: 10, flexDirection: "row", alignItems: "flex-start", gap: 10, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 4, borderWidth: 2, borderColor: "white" },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  label: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  phone: { color: colors.blue, fontSize: 10, fontWeight: "800", marginTop: 3 },
  priority: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.softRed, flexDirection: "row", alignItems: "center", gap: 3 },
  priorityText: { color: colors.red, fontSize: 8, fontWeight: "900" },
  items: { gap: 4, marginTop: 7 },
  item: { minHeight: 25, paddingHorizontal: 7, borderRadius: 7, backgroundColor: colors.background, flexDirection: "row", alignItems: "center", gap: 5 },
  itemText: { flex: 1, color: colors.ink, fontSize: 9, fontWeight: "700" },
  noItems: { color: colors.muted, fontSize: 9, fontStyle: "italic", marginTop: 5 }
});
