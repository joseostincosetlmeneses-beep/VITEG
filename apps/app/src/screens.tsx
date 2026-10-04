import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardSummary, SessionUser } from "@viteg/shared";
import { api } from "./api";
import { Button, Card, Loading, SectionTitle, StatusPill } from "./components";
import { colors, radius } from "./theme";

const icon = (name: keyof typeof Ionicons.glyphMap, size = 20, color: string = colors.muted) => (
  <Ionicons name={name} size={size} color={color} />
);

function Metric({ label, value, tone, glyph }: { label: string; value: string | number; tone: string; glyph: keyof typeof Ionicons.glyphMap }) {
  return (
    <Card style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}>{icon(glyph, 22, tone)}</View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

export function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSummary, nextRoutes] = await Promise.all([api.dashboard(), api.routes()]);
      setSummary(nextSummary);
      setRoutes(nextRoutes.slice(0, 5));
    } catch (error) {
      Alert.alert("No se pudo cargar", error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading && !summary) return <Loading />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.page}>
      <SectionTitle title="Centro de operaciones" subtitle="Resumen operativo en tiempo real" />
      <View style={styles.metricGrid}>
        <Metric label="Rutas hoy" value={summary?.routesToday ?? 0} tone={colors.blue} glyph="map-outline" />
        <Metric label="Repartidores activos" value={summary?.activeDrivers ?? 0} tone={colors.green} glyph="people-outline" />
        <Metric label="Entregas completadas" value={`${summary?.completedDeliveries ?? 0}/${summary?.totalDeliveries ?? 0}`} tone={colors.sky} glyph="checkmark-done-outline" />
        <Metric label="Incidencias" value={summary?.failedDeliveries ?? 0} tone={colors.red} glyph="warning-outline" />
      </View>

      <View style={styles.twoColumns}>
        <Card style={{ flex: 1.4, minWidth: 300 }}>
          <View style={styles.cardHeading}>
            <View><Text style={styles.cardTitle}>Operación de hoy</Text><Text style={styles.cardSubtitle}>Rutas y progreso</Text></View>
            <View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>EN VIVO</Text></View>
          </View>
          {routes.length === 0 ? <Empty text="Todavía no hay rutas programadas." /> : routes.map((route) => (
            <View key={route._id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.softBlue }]}>{icon("car-outline", 20, colors.blue)}</View>
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{route.name}</Text><Text style={styles.rowMeta}>{route.driverId ? `${route.driverId.firstName} ${route.driverId.lastName}` : "Sin asignar"} · {route.stopCount} paradas</Text></View>
              <View style={{ alignItems: "flex-end", gap: 7 }}><StatusPill value={route.status} /><Text style={styles.rowMeta}>{route.completedStopCount}/{route.stopCount}</Text></View>
            </View>
          ))}
        </Card>
        <Card style={{ flex: 1, minWidth: 280 }}>
          <Text style={styles.cardTitle}>Mapa operativo</Text>
          <View style={styles.mapMock}>
            <View style={[styles.mapRoad, { transform: [{ rotate: "18deg" }] }]} />
            <View style={[styles.mapRoad, { transform: [{ rotate: "-36deg" }] }]} />
            <View style={[styles.mapPin, { left: "24%", top: "34%" }]}>{icon("car", 16, "white")}</View>
            <View style={[styles.mapPin, { left: "67%", top: "57%", backgroundColor: colors.green }]}>{icon("car", 16, "white")}</View>
            <View style={[styles.customerPin, { left: "48%", top: "22%" }]} />
            <View style={[styles.customerPin, { left: "42%", top: "71%" }]} />
            <Text style={styles.mapNote}>Proveedor de mapas pendiente de configuración</Text>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

export function RoutesScreen({ driver = false }: { driver?: boolean }) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setRoutes(await api.routes()); } catch (error) { Alert.alert("Rutas", String(error)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const updateStatus = async (route: any) => {
    const next = route.status === "ASSIGNED" ? "IN_PROGRESS" : route.status === "IN_PROGRESS" ? "COMPLETED" : null;
    if (!next) return;
    try { await api.updateRouteStatus(route._id, next); await load(); } catch (error) { Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : String(error)); }
  };
  if (loading) return <Loading />;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={driver ? "Mi ruta" : "Rutas"} subtitle={driver ? "Tu jornada y próximas paradas" : "Planeación, asignación y seguimiento"} />
      {routes.length === 0 ? <Card><Empty text="No hay rutas disponibles." /></Card> : routes.map((route) => (
        <Card key={route._id} style={{ marginBottom: 12 }}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}><Text style={styles.routeName}>{route.name}</Text><Text style={styles.rowMeta}>{new Date(route.date).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</Text></View>
            <StatusPill value={route.status} />
          </View>
          <View style={styles.routeStats}>
            <SmallStat iconName="location-outline" value={`${route.completedStopCount}/${route.stopCount}`} label="Paradas" />
            <SmallStat iconName="time-outline" value={route.startTime ?? "--:--"} label="Salida" />
            <SmallStat iconName="car-outline" value={route.vehicleLabel ?? "Sin unidad"} label="Vehículo" />
          </View>
          {driver && ["ASSIGNED", "IN_PROGRESS"].includes(route.status) && (
            <Button label={route.status === "ASSIGNED" ? "Iniciar ruta" : "Finalizar ruta"} icon={route.status === "ASSIGNED" ? "play" : "flag"} onPress={() => void updateStatus(route)} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

function SmallStat({ iconName, value, label }: { iconName: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return <View style={styles.smallStat}>{icon(iconName, 18, colors.sky)}<View><Text style={styles.smallValue}>{value}</Text><Text style={styles.smallLabel}>{label}</Text></View></View>;
}

const resourceConfig: Record<string, { title: string; subtitle: string; path?: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Repartidores: { title: "Repartidores", subtitle: "Cuentas, autorización y estado laboral", path: "/users?role=DRIVER", icon: "people-outline" },
  Clientes: { title: "Clientes", subtitle: "Personas, negocios y empresas", path: "/customers", icon: "business-outline" },
  Domicilios: { title: "Domicilios", subtitle: "Ubicaciones, referencias y ventanas de entrega", path: "/addresses", icon: "location-outline" },
  Zonas: { title: "Zonas", subtitle: "Organización geográfica de la operación", path: "/zones", icon: "grid-outline" },
  Productos: { title: "Productos", subtitle: "Catálogo y prioridad logística", path: "/products", icon: "cube-outline" },
  Entregas: { title: "Entregas", subtitle: "Historial, evidencia y resultados", path: "/distribution/deliveries", icon: "checkmark-circle-outline" },
  Solicitudes: { title: "Solicitudes", subtitle: "Altas de domicilio enviadas por repartidores", path: "/address-requests", icon: "document-text-outline" },
  Chat: { title: "Chat", subtitle: "Conversaciones directas y por ruta", path: "/messaging/conversations", icon: "chatbubbles-outline" },
  Notificaciones: { title: "Notificaciones", subtitle: "Eventos relevantes de la operación", path: "/notifications", icon: "notifications-outline" },
  Agenda: { title: "Agenda", subtitle: "Calendario operativo y rutas recurrentes", icon: "calendar-outline" },
  Monitor: { title: "Monitor", subtitle: "Ubicación actual de los repartidores", path: "/tracking/locations/latest", icon: "navigate-circle-outline" },
  Reportes: { title: "Reportes", subtitle: "Indicadores de rutas, entregas y productividad", icon: "bar-chart-outline" },
  Configuración: { title: "Configuración", subtitle: "Preferencias generales del sistema", icon: "settings-outline" },
  Perfil: { title: "Mi perfil", subtitle: "Datos personales y estado de cuenta", icon: "person-circle-outline" },
  Mapa: { title: "Mapa", subtitle: "Navegación de la ruta activa", icon: "map-outline" },
  "Nuevo domicilio": { title: "Nuevo domicilio", subtitle: "Envía una solicitud para revisión", icon: "add-circle-outline" }
};

export function ResourceScreen({ name }: { name: string }) {
  const config = resourceConfig[name] ?? resourceConfig.Configuración!;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(config.path));
  useEffect(() => {
    if (!config.path) return;
    void api.list(config.path).then(setRows).catch((error) => Alert.alert(config.title, error.message)).finally(() => setLoading(false));
  }, [config.path, config.title]);
  if (loading) return <Loading />;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={config.title} subtitle={config.subtitle} action={<Button label="Actualizar" variant="secondary" icon="refresh" onPress={() => { if (config.path) void api.list(config.path).then(setRows); }} />} />
      <Card>
        {!config.path ? (
          <View style={styles.comingSoon}>{icon(config.icon, 44, colors.sky)}<Text style={styles.comingTitle}>Módulo preparado</Text><Text style={styles.comingText}>La estructura, permisos y navegación ya están definidos. La siguiente iteración conectará su flujo especializado.</Text></View>
        ) : rows.length === 0 ? <Empty text="No hay registros todavía." /> : rows.map((row, index) => {
          const title = row.name || row.businessName || `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.title || row.alias || `Registro ${index + 1}`;
          const meta = row.email || row.phone || row.code || row.type || row.body || row.addressData?.street || "Registro activo";
          return (
            <View key={row._id ?? index} style={styles.row}>
              <View style={styles.avatar}>{icon(config.icon, 20, colors.blue)}</View>
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{meta}</Text></View>
              {(row.status || typeof row.isActive === "boolean") && <StatusPill value={row.status ?? (row.isActive ? "ACTIVE" : "INACTIVE")} />}
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

export function DriverHome({ user, onNavigate }: { user: SessionUser; onNavigate: (name: string) => void }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  useEffect(() => { void Promise.all([api.dashboard(), api.routes()]).then(([a, b]) => { setSummary(a); setRoutes(b); }); }, []);
  const active = routes.find((route) => ["ASSIGNED", "IN_PROGRESS", "PAUSED"].includes(route.status));
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.greeting}>Buenos días, {user.name.split(" ")[0]}</Text>
      <Text style={styles.date}>{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</Text>
      <Card style={styles.heroRoute}>
        <View style={styles.rowTop}><Text style={styles.heroEyebrow}>RUTA DE HOY</Text>{active && <StatusPill value={active.status} />}</View>
        <Text style={styles.heroTitle}>{active?.name ?? "Sin ruta asignada"}</Text>
        <Text style={styles.heroMeta}>{active ? `${active.stopCount} paradas · ${active.completedStopCount} completadas` : "Consulta más tarde o contacta al administrador"}</Text>
        <View style={styles.progress}><View style={[styles.progressFill, { width: active?.stopCount ? `${Math.round((active.completedStopCount / active.stopCount) * 100)}%` : "0%" }]} /></View>
        {active && <Button label={active.status === "ASSIGNED" ? "Ver e iniciar ruta" : "Continuar ruta"} icon="navigate" onPress={() => onNavigate("Mi Ruta")} />}
      </Card>
      <View style={styles.metricGrid}>
        <Metric label="Completadas" value={summary?.completedDeliveries ?? 0} tone={colors.green} glyph="checkmark-circle-outline" />
        <Metric label="Pendientes" value={summary?.pendingDeliveries ?? 0} tone={colors.amber} glyph="time-outline" />
        <Metric label="Solicitudes" value={summary?.pendingRequests ?? 0} tone={colors.blue} glyph="document-text-outline" />
      </View>
      <SectionTitle title="Acciones rápidas" />
      <View style={styles.quickGrid}>
        <QuickAction label="Abrir mapa" glyph="map-outline" onPress={() => onNavigate("Mapa")} />
        <QuickAction label="Nuevo domicilio" glyph="add-circle-outline" onPress={() => onNavigate("Nuevo domicilio")} />
        <QuickAction label="Enviar mensaje" glyph="chatbubble-ellipses-outline" onPress={() => onNavigate("Chat")} />
      </View>
    </ScrollView>
  );
}

function QuickAction({ label, glyph, onPress }: { label: string; glyph: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.quick}>{icon(glyph, 25, colors.blue)}<Text style={styles.quickText}>{label}</Text></Pressable>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}>{icon("water-outline", 38, colors.border)}<Text style={styles.emptyText}>{text}</Text></View>;
}

export const adminNavigation = [
  { section: "General", items: [["Inicio", "home-outline"], ["Monitor", "navigate-circle-outline"]] },
  { section: "Operación", items: [["Rutas", "map-outline"], ["Agenda", "calendar-outline"], ["Entregas", "checkmark-done-outline"]] },
  { section: "Personas", items: [["Repartidores", "people-outline"], ["Clientes", "business-outline"]] },
  { section: "Logística", items: [["Domicilios", "location-outline"], ["Zonas", "grid-outline"], ["Productos", "cube-outline"]] },
  { section: "Comunicación", items: [["Solicitudes", "document-text-outline"], ["Chat", "chatbubbles-outline"], ["Notificaciones", "notifications-outline"]] },
  { section: "Análisis", items: [["Reportes", "bar-chart-outline"], ["Configuración", "settings-outline"]] }
] as const;

export const driverNavigation = [
  { section: "Ruta", items: [["Inicio", "home-outline"], ["Mi Ruta", "map-outline"], ["Mapa", "navigate-outline"], ["Entregas", "checkmark-done-outline"]] },
  { section: "Cuenta", items: [["Nuevo domicilio", "add-circle-outline"], ["Chat", "chatbubbles-outline"], ["Notificaciones", "notifications-outline"], ["Perfil", "person-circle-outline"]] }
] as const;

const styles = StyleSheet.create({
  page: { padding: 24, gap: 14, maxWidth: 1440, width: "100%", alignSelf: "center" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { flexGrow: 1, flexBasis: 190, minWidth: 175 },
  metricIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  metricValue: { fontSize: 27, fontWeight: "900", color: colors.ink },
  metricLabel: { fontSize: 13, color: colors.muted, marginTop: 3 },
  twoColumns: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  cardSubtitle: { fontSize: 13, color: colors.muted, marginTop: 3 },
  live: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.softGreen, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  liveText: { color: colors.green, fontWeight: "900", fontSize: 10 },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#EDF2F7", paddingVertical: 10 },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.softBlue, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  mapMock: { height: 280, marginTop: 14, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#EAF4F8", position: "relative" },
  mapRoad: { position: "absolute", width: "140%", height: 16, backgroundColor: "white", top: "48%", left: "-20%", borderColor: "#D7E5EA", borderWidth: 1 },
  mapPin: { position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "white" },
  customerPin: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: colors.amber, borderWidth: 3, borderColor: "white" },
  mapNote: { position: "absolute", bottom: 12, alignSelf: "center", backgroundColor: "rgba(255,255,255,.9)", color: colors.muted, fontSize: 11, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routeName: { fontSize: 19, fontWeight: "900", color: colors.ink },
  routeStats: { flexDirection: "row", flexWrap: "wrap", gap: 22, paddingVertical: 18 },
  smallStat: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 105 },
  smallValue: { fontSize: 14, fontWeight: "800", color: colors.ink },
  smallLabel: { fontSize: 11, color: colors.muted },
  comingSoon: { minHeight: 320, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  comingTitle: { fontSize: 20, fontWeight: "900", color: colors.ink },
  comingText: { maxWidth: 460, textAlign: "center", lineHeight: 21, color: colors.muted },
  greeting: { fontSize: 29, fontWeight: "900", color: colors.ink },
  date: { fontSize: 14, color: colors.muted, textTransform: "capitalize", marginTop: -9 },
  heroRoute: { backgroundColor: colors.navy, borderColor: colors.navy, padding: 22 },
  heroEyebrow: { color: colors.cyan, fontWeight: "900", fontSize: 11, letterSpacing: 1.2 },
  heroTitle: { color: "white", fontSize: 25, fontWeight: "900", marginTop: 14 },
  heroMeta: { color: "#BCCCDC", marginTop: 5 },
  progress: { height: 7, borderRadius: 4, backgroundColor: "#334E68", overflow: "hidden", marginVertical: 20 },
  progressFill: { height: "100%", backgroundColor: colors.cyan, borderRadius: 4 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quick: { flexGrow: 1, flexBasis: 150, minHeight: 100, borderRadius: radius.md, backgroundColor: "white", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 9 },
  quickText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: colors.muted, fontSize: 14 }
});
