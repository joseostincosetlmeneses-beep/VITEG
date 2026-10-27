import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "./api";
import { Button, Card, Field, Loading, SectionTitle, StatusPill } from "./components";
import { colors, radius } from "./theme";

type AgendaFilter = "WEEKLY" | "UPCOMING" | "HISTORY";

const weekDays = [
  { value: 1, short: "Lun", label: "Lunes" },
  { value: 2, short: "Mar", label: "Martes" },
  { value: 3, short: "Mié", label: "Miércoles" },
  { value: 4, short: "Jue", label: "Jueves" },
  { value: 5, short: "Vie", label: "Viernes" },
  { value: 6, short: "Sáb", label: "Sábado" },
  { value: 0, short: "Dom", label: "Domingo" }
] as const;

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function AgendaScreen() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AgendaFilter>("WEEKLY");
  const [selectedWeekday, setSelectedWeekday] = useState(() => new Date().getDay());
  const [reusing, setReusing] = useState<any | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRoutes(await api.routes()); }
    catch (error) { Alert.alert("Agenda", error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const today = startOfToday();
    return routes
      .filter((route) => {
        if (filter === "WEEKLY") return false;
        const routeDate = new Date(route.date);
        const terminal = ["COMPLETED", "CANCELLED"].includes(route.status);
        return filter === "HISTORY" ? terminal || routeDate < today : !terminal && routeDate >= today;
      })
      .sort((a, b) => filter === "HISTORY"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filter, routes]);
  const groups = useMemo(() => {
    const next = new Map<string, any[]>();
    filtered.forEach((route) => {
      const key = dateKey(route.date);
      next.set(key, [...(next.get(key) ?? []), route]);
    });
    return [...next.entries()];
  }, [filtered]);
  const recurringSeries = useMemo(() => {
    const bySeries = new Map<string, any>();
    routes.filter((route) => route.recurrence?.enabled).forEach((route) => {
      const key = String(route.recurrence?.seriesId ?? route._id);
      const current = bySeries.get(key);
      if (!current) {
        bySeries.set(key, route);
        return;
      }
      const routeTerminal = ["COMPLETED", "CANCELLED"].includes(route.status);
      const currentTerminal = ["COMPLETED", "CANCELLED"].includes(current.status);
      if ((currentTerminal && !routeTerminal) || new Date(route.date) > new Date(current.date)) bySeries.set(key, route);
    });
    return [...bySeries.values()];
  }, [routes]);
  const weeklyRoutes = useMemo(() => {
    return recurringSeries
      .filter((route) => route.recurrence.weekdays?.includes(selectedWeekday))
      .sort((a, b) => String(a.startTime ?? "99:99").localeCompare(String(b.startTime ?? "99:99")));
  }, [recurringSeries, selectedWeekday]);

  if (loading && routes.length === 0) return <Loading />;
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.page}>
      <SectionTitle title="Agenda" subtitle="Horario semanal de rutas fijas y jornadas programadas" />
      <View style={styles.filters}>
        <FilterButton active={filter === "WEEKLY"} label="Horario" onPress={() => setFilter("WEEKLY")} />
        <FilterButton active={filter === "UPCOMING"} label="Próximas" onPress={() => setFilter("UPCOMING")} />
        <FilterButton active={filter === "HISTORY"} label="Historial" onPress={() => setFilter("HISTORY")} />
      </View>
      {filter === "WEEKLY" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
            {weekDays.map((day) => {
              const active = selectedWeekday === day.value;
              const count = recurringSeries.filter((route) => route.recurrence.weekdays?.includes(day.value)).length;
              return (
                <Pressable key={day.value} onPress={() => setSelectedWeekday(day.value)} style={[styles.weekDay, active && styles.weekDayActive]}>
                  <Text style={[styles.weekDayShort, active && styles.weekDayTextActive]}>{day.short}</Text>
                  <Text style={[styles.weekDayCount, active && styles.weekDayTextActive]}>{count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.weekHeading}>
            <View><Text style={styles.weekTitle}>{weekDays.find((day) => day.value === selectedWeekday)?.label}</Text><Text style={styles.weekSubtitle}>{weeklyRoutes.length} ruta{weeklyRoutes.length === 1 ? "" : "s"} fija{weeklyRoutes.length === 1 ? "" : "s"}</Text></View>
            <View style={styles.fixedBadge}><Ionicons name="repeat" size={14} color={colors.blue} /><Text style={styles.fixedBadgeText}>SEMANAL</Text></View>
          </View>
          {weeklyRoutes.length === 0 ? (
            <Card><View style={styles.empty}><Ionicons name="calendar-outline" size={38} color={colors.border} /><Text style={styles.emptyText}>No hay rutas fijas para este día.</Text><Text style={styles.emptyHint}>En Rutas, crea o edita una ruta y activa “Ruta fija semanal”.</Text></View></Card>
          ) : (
            <Card style={styles.timetableCard}>
              {weeklyRoutes.map((route, index) => (
                <View key={route._id} style={[styles.classRow, index < weeklyRoutes.length - 1 && styles.routeRowBorder]}>
                  <View style={styles.classTime}><Text style={styles.classTimeText}>{route.startTime ?? "--:--"}</Text><Text style={styles.classEndText}>{route.estimatedReturnTime ?? "Salida"}</Text></View>
                  <View style={styles.classAccent} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.routeHeading}><Text style={styles.routeName}>{route.name}</Text><StatusPill value={route.status} /></View>
                    <Text style={styles.meta}>{route.driverId ? `${route.driverId.firstName} ${route.driverId.lastName}` : "Sin repartidor"} · {route.waypoints?.length ?? 0} paradas</Text>
                    <Text style={styles.meta}>{route.vehicleLabel ?? "Sin unidad"} · Próxima jornada {new Date(route.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</Text>
                    <View style={styles.repeatDays}>{route.recurrence.weekdays.map((value: number) => <Text key={value} style={styles.repeatDay}>{weekDays.find((day) => day.value === value)?.short}</Text>)}</View>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </>
      ) : groups.length === 0 ? (
        <Card><View style={styles.empty}><Ionicons name="calendar-outline" size={38} color={colors.border} /><Text style={styles.emptyText}>No hay rutas en esta sección.</Text></View></Card>
      ) : groups.map(([key, dayRoutes]) => (
        <View key={key} style={styles.daySection}>
          <View style={styles.dayHeader}>
            <View style={styles.dayBadge}><Text style={styles.dayNumber}>{new Date(`${key}T12:00:00`).getDate()}</Text><Text style={styles.dayMonth}>{new Date(`${key}T12:00:00`).toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}</Text></View>
            <View><Text style={styles.dayTitle}>{new Date(`${key}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long" })}</Text><Text style={styles.daySubtitle}>{new Date(`${key}T12:00:00`).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</Text></View>
          </View>
          <Card style={styles.scheduleCard}>
            {dayRoutes.map((route, index) => (
              <View key={route._id} style={[styles.routeRow, index < dayRoutes.length - 1 && styles.routeRowBorder]}>
                <View style={styles.timeColumn}><Text style={styles.time}>{route.startTime ?? "--:--"}</Text><View style={styles.timelineDot} />{index < dayRoutes.length - 1 && <View style={styles.timelineLine} />}</View>
                <View style={{ flex: 1 }}>
                  <View style={styles.routeHeading}><Text style={styles.routeName}>{route.name}</Text><StatusPill value={route.status} /></View>
                  <Text style={styles.meta}>{route.driverId ? `${route.driverId.firstName} ${route.driverId.lastName}` : "Sin repartidor"} · {route.waypoints?.length ?? 0} paradas</Text>
                  <Text style={styles.meta}>{route.vehicleLabel ?? "Sin unidad asignada"}</Text>
                  <Pressable style={styles.reuseButton} onPress={() => setReusing(route)}>
                    <Ionicons name="copy-outline" size={17} color={colors.blue} />
                    <Text style={styles.reuseText}>Programar nuevamente</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ))}
      <ReuseRouteModal route={reusing} onClose={() => setReusing(null)} onCreated={() => { setReusing(null); setFilter("UPCOMING"); void load(); }} />
    </ScrollView>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>;
}

function ReuseRouteModal({ route, onClose, onCreated }: { route: any | null; onClose: () => void; onCreated: () => void }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState("08:00");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!route) return;
    const next = new Date(); next.setDate(next.getDate() + 1);
    setDate(next.toISOString().slice(0, 10));
    setTime(route.startTime ?? "08:00");
  }, [route]);
  const create = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert("Fecha inválida", "Usa el formato AAAA-MM-DD."); return; }
    setSaving(true);
    try {
      await api.createRoute({
        name: route.name,
        date: `${date}T12:00:00`,
        startTime: time,
        estimatedReturnTime: route.estimatedReturnTime,
        vehicleLabel: route.vehicleLabel,
        driverId: typeof route.driverId === "string" ? route.driverId : route.driverId?._id ?? null,
        origin: route.origin,
        destination: route.destination,
        waypoints: (route.waypoints ?? []).map((point: any) => ({
          label: point.label,
          latitude: point.latitude,
          longitude: point.longitude,
          customerId: typeof point.customerId === "string" ? point.customerId : point.customerId?._id,
          addressId: typeof point.addressId === "string" ? point.addressId : point.addressId?._id,
          priority: point.priority ?? 0,
          items: (point.items ?? []).map((item: any) => ({ productId: typeof item.productId === "string" ? item.productId : item.productId?._id, expectedQuantity: item.expectedQuantity }))
        }))
      });
      onCreated();
      Alert.alert("Ruta programada", `Se creó una nueva jornada para el ${date}.`);
    } catch (error) { Alert.alert("No se pudo programar", error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={Boolean(route)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}><View style={styles.modalCard}>
        <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Programar nuevamente</Text><Text style={styles.meta}>{route?.name}</Text></View><Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
        <View style={styles.modalContent}>
          <Text style={styles.explanation}>Se creará una nueva jornada conservando clientes, productos, prioridades, camioneta y repartidor. La ruta original permanecerá en el historial.</Text>
          <Field label="Nueva fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
          <Field label="Hora de salida" value={time} onChangeText={setTime} autoCapitalize="none" />
          <Button label={saving ? "Programando…" : "Crear nueva jornada"} icon="calendar-outline" disabled={saving} onPress={() => void create()} />
        </View>
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, width: "100%", alignSelf: "center" },
  filters: { flexDirection: "row", gap: 7 },
  filter: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  filterActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  filterTextActive: { color: "white" },
  weekStrip: { gap: 8, paddingVertical: 2 },
  weekDay: { width: 58, minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "white", alignItems: "center", justifyContent: "center", gap: 5 },
  weekDayActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  weekDayShort: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  weekDayCount: { minWidth: 23, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, overflow: "hidden", textAlign: "center", color: colors.blue, backgroundColor: colors.softBlue, fontSize: 9, fontWeight: "900" },
  weekDayTextActive: { color: "white", backgroundColor: "rgba(255,255,255,0.18)" },
  weekHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 },
  weekTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  weekSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  fixedBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.softBlue },
  fixedBadgeText: { color: colors.blue, fontSize: 9, fontWeight: "900" },
  timetableCard: { paddingVertical: 4 },
  classRow: { minHeight: 112, flexDirection: "row", gap: 11, paddingVertical: 15 },
  classTime: { width: 48, alignItems: "center" },
  classTimeText: { color: colors.blue, fontSize: 13, fontWeight: "900" },
  classEndText: { color: colors.muted, fontSize: 8, marginTop: 5 },
  classAccent: { width: 4, alignSelf: "stretch", borderRadius: 3, backgroundColor: colors.blue },
  repeatDays: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  repeatDay: { color: colors.blue, backgroundColor: colors.softBlue, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: "hidden", fontSize: 8, fontWeight: "900" },
  daySection: { gap: 9 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayBadge: { width: 48, height: 52, borderRadius: 13, backgroundColor: colors.softBlue, alignItems: "center", justifyContent: "center" },
  dayNumber: { color: colors.blue, fontSize: 20, lineHeight: 22, fontWeight: "900" },
  dayMonth: { color: colors.blue, fontSize: 9, textTransform: "uppercase", fontWeight: "900" },
  dayTitle: { color: colors.ink, fontSize: 15, textTransform: "capitalize", fontWeight: "900" },
  daySubtitle: { color: colors.muted, fontSize: 10, marginTop: 2 },
  scheduleCard: { paddingVertical: 4 },
  routeRow: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  routeRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  timeColumn: { width: 48, alignItems: "center", position: "relative" },
  time: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue, borderWidth: 2, borderColor: "white", marginTop: 8, zIndex: 2 },
  timelineLine: { position: "absolute", width: 2, top: 42, bottom: -18, backgroundColor: colors.border },
  routeHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  routeName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  reuseButton: { alignSelf: "flex-start", minHeight: 36, paddingHorizontal: 10, marginTop: 9, borderRadius: 9, backgroundColor: colors.softBlue, flexDirection: "row", alignItems: "center", gap: 5 },
  reuseText: { color: colors.blue, fontSize: 10, fontWeight: "900" },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 9 },
  emptyText: { color: colors.muted, fontSize: 13 },
  emptyHint: { maxWidth: 260, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,42,67,0.48)" },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  modalHeader: { padding: 18, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  close: { width: 42, height: 42, borderRadius: 12, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  modalContent: { padding: 18, paddingBottom: 34, gap: 14 },
  explanation: { color: colors.muted, fontSize: 11, lineHeight: 17, padding: 11, borderRadius: radius.sm, backgroundColor: colors.softBlue }
});
