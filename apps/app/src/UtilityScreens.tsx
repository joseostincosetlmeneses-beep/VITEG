import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardSummary, SessionUser } from "@viteg/shared";
import { API_URL, api } from "./api";
import { Button, Card, Loading, SectionTitle, StatusPill } from "./components";
import { DriverTrackingMap } from "./DriverTrackingMap";
import { colors, radius } from "./theme";

const icon = (name: keyof typeof Ionicons.glyphMap, size = 21, color: string = colors.blue) => (
  <Ionicons name={name} size={size} color={color} />
);

function relativeDate(value?: string) {
  if (!value) return "Ahora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationsScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.list("/notifications"));
    } catch (error) {
      Alert.alert("Notificaciones", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const markRead = async (row: any) => {
    if (row.readAt) return;
    try {
      const updated = await api.update(`/notifications/${row._id}/read`, {});
      setRows((current) => current.map((item) => item._id === row._id ? updated : item));
    } catch (error) {
      Alert.alert("Notificaciones", error instanceof Error ? error.message : String(error));
    }
  };

  const markAllRead = async () => {
    const unread = rows.filter((row) => !row.readAt);
    if (!unread.length) return;
    try {
      const updated = await Promise.all(unread.map((row) => api.update(`/notifications/${row._id}/read`, {})));
      const byId = new Map(updated.map((row: any) => [row._id, row]));
      setRows((current) => current.map((row) => byId.get(row._id) ?? row));
    } catch (error) {
      Alert.alert("Notificaciones", error instanceof Error ? error.message : String(error));
    }
  };

  if (loading && rows.length === 0) return <Loading />;
  const unreadCount = rows.filter((row) => !row.readAt).length;
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <SectionTitle
        title="Notificaciones"
        subtitle={unreadCount ? `${unreadCount} pendiente${unreadCount === 1 ? "" : "s"} de leer` : "Todo está al día"}
        action={unreadCount ? <Button label="Leer todas" icon="checkmark-done" variant="secondary" onPress={() => void markAllRead()} /> : undefined}
      />
      <Card>
        {rows.length === 0 ? (
          <Empty iconName="notifications-off-outline" text="Aún no tienes notificaciones." />
        ) : rows.map((row) => (
          <Pressable key={row._id} onPress={() => void markRead(row)} style={[styles.notification, !row.readAt && styles.notificationUnread]}>
            <View style={[styles.iconBox, !row.readAt && { backgroundColor: colors.softBlue }]}>
              {icon(row.readAt ? "notifications-outline" : "notifications", 22, row.readAt ? colors.muted : colors.blue)}
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, !row.readAt && styles.unreadTitle]}>{row.title ?? "Notificación"}</Text>
              {!!row.body && <Text style={styles.rowMeta}>{row.body}</Text>}
              <Text style={styles.time}>{relativeDate(row.createdAt)}</Text>
            </View>
            {!row.readAt && <View style={styles.unreadDot} />}
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

export function MonitorScreen() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLocations(await api.latestDriverLocations());
    } catch (error) {
      Alert.alert("Monitor", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => void api.latestDriverLocations().then(setLocations).catch(() => undefined), 15000);
    return () => clearInterval(interval);
  }, []);
  if (loading && locations.length === 0) return <Loading />;
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <SectionTitle title="Monitor de repartidores" subtitle="Ubicación reportada durante rutas activas" />
      <Card>
        <View style={styles.liveRow}><View style={styles.liveDot} /><Text style={styles.liveText}>ACTUALIZACIÓN CADA 15 S</Text></View>
        <DriverTrackingMap locations={locations} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Repartidores localizados</Text>
        {locations.length === 0 ? <Empty iconName="location-outline" text="No hay repartidores reportando ubicación." /> : locations.map((row) => {
          const name = row.driverId ? `${row.driverId.firstName ?? ""} ${row.driverId.lastName ?? ""}`.trim() : "Repartidor";
          return (
            <View key={row._id} style={styles.dataRow}>
              <View style={styles.iconBox}>{icon("car-outline")}</View>
              <View style={styles.flex}><Text style={styles.rowTitle}>{name}</Text><Text style={styles.rowMeta}>Actualizado: {relativeDate(row.recordedAt)}</Text></View>
              <View style={styles.liveDot} />
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const activityIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  CREATE: "add-circle-outline",
  UPDATE: "create-outline",
  DELETE: "trash-outline",
  ASSIGN: "person-add-outline",
  STATUS: "swap-horizontal-outline",
  REQUEST: "document-text-outline",
  APPROVE: "checkmark-circle-outline",
  REJECT: "close-circle-outline",
  DELIVERY: "cube-outline"
};

const activityTones: Record<string, string> = {
  CREATE: colors.green,
  UPDATE: colors.blue,
  DELETE: colors.red,
  ASSIGN: colors.sky,
  STATUS: colors.amber,
  REQUEST: colors.blue,
  APPROVE: colors.green,
  REJECT: colors.red,
  DELIVERY: colors.green
};

export function ActivityLogScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.list("/activity?limit=150"));
    } catch (error) {
      Alert.alert("Registro de actividad", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading && rows.length === 0) return <Loading />;
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <SectionTitle title="Registro de actividad" subtitle="Cambios realizados por administradores y repartidores" />
      <Card>
        <View style={styles.activitySummary}>
          <View style={styles.activitySummaryIcon}>{icon("shield-checkmark-outline", 24)}</View>
          <View style={styles.flex}><Text style={styles.cardTitleNoMargin}>{rows.length} movimientos recientes</Text><Text style={styles.rowMeta}>Los registros se guardan automáticamente</Text></View>
        </View>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <Empty iconName="time-outline" text="Los próximos cambios aparecerán en este registro." />
        ) : rows.map((row, index) => {
          const tone = activityTones[row.action] ?? colors.blue;
          return (
            <View key={row._id ?? index} style={styles.activityRow}>
              <View style={[styles.activityLine, index === rows.length - 1 && { backgroundColor: "transparent" }]} />
              <View style={[styles.activityIcon, { backgroundColor: `${tone}18` }]}>
                {icon(activityIcons[row.action] ?? "ellipse-outline", 20, tone)}
              </View>
              <View style={styles.flex}>
                <Text style={styles.activityText}><Text style={styles.activityActor}>{row.actorName ?? "Usuario"}</Text> {row.summary}</Text>
                <View style={styles.activityMeta}>
                  <Text style={styles.time}>{relativeDate(row.createdAt)}</Text>
                  {!!row.entityType && <Text style={styles.entityTag}>{entityName(row.entityType)}</Text>}
                </View>
              </View>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function entityName(value: string) {
  const names: Record<string, string> = {
    Customer: "Cliente", CustomerAddress: "Domicilio", Product: "Producto", Zone: "Zona",
    Route: "Ruta", RouteStop: "Parada", User: "Usuario", AddressRequest: "Solicitud", Delivery: "Entrega"
  };
  return names[value] ?? value;
}

export function ReportsScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSummary, nextRoutes] = await Promise.all([api.dashboard(), api.routes()]);
      setSummary(nextSummary);
      setRoutes(nextRoutes);
    } catch (error) {
      Alert.alert("Reportes", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const routeCounts = useMemo(() => routes.reduce<Record<string, number>>((result, route) => {
    result[route.status] = (result[route.status] ?? 0) + 1;
    return result;
  }, {}), [routes]);
  const deliveryRate = summary?.totalDeliveries
    ? Math.round((summary.completedDeliveries / summary.totalDeliveries) * 100)
    : 0;
  if (loading && !summary) return <Loading />;
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <SectionTitle title="Reportes" subtitle="Resumen actual de rutas y entregas" />
      <View style={styles.metricGrid}>
        <ReportMetric iconName="map-outline" value={summary?.routesToday ?? 0} label="Rutas de hoy" tone={colors.blue} />
        <ReportMetric iconName="checkmark-done-outline" value={`${deliveryRate}%`} label="Cumplimiento" tone={colors.green} />
        <ReportMetric iconName="time-outline" value={summary?.pendingDeliveries ?? 0} label="Entregas pendientes" tone={colors.amber} />
        <ReportMetric iconName="warning-outline" value={summary?.failedDeliveries ?? 0} label="Incidencias" tone={colors.red} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Estado de las rutas</Text>
        {Object.keys(routeCounts).length === 0 ? <Empty iconName="analytics-outline" text="Todavía no hay rutas para analizar." /> : Object.entries(routeCounts).map(([status, count]) => (
          <View key={status} style={styles.dataRow}><StatusPill value={status} /><View style={styles.flex} /><Text style={styles.count}>{count}</Text></View>
        ))}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Entregas de hoy</Text>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${deliveryRate}%` }]} /></View>
        <Text style={styles.progressText}>{summary?.completedDeliveries ?? 0} completadas de {summary?.totalDeliveries ?? 0}</Text>
      </Card>
    </ScrollView>
  );
}

export function SettingsScreen({ user, onLogout, profile = false }: { user: SessionUser; onLogout: () => void; profile?: boolean }) {
  const [checking, setChecking] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const checkConnection = async () => {
    setChecking(true);
    try {
      await api.health();
      setServiceStatus("ok");
      Alert.alert("Conexión correcta", "La aplicación puede comunicarse con el servidor VITEG.");
    } catch (error) {
      setServiceStatus("error");
      Alert.alert("Sin conexión", error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={profile ? "Mi perfil" : "Configuración"} subtitle={profile ? "Cuenta y permisos de acceso" : "Estado de la aplicación y cuenta"} />
      <Card>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}><Text style={styles.profileInitial}>{user.name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.flex}><Text style={styles.profileName}>{user.name}</Text><Text style={styles.rowMeta}>{user.email}</Text></View>
          <StatusPill value={user.status} />
        </View>
        <InfoRow iconName={user.role === "ADMIN" ? "briefcase-outline" : "car-outline"} label="Rol" value={user.role === "ADMIN" ? "Administrador" : "Repartidor"} />
        <InfoRow iconName="shield-checkmark-outline" label="Permisos" value={user.role === "ADMIN" ? "Gestión completa" : "Operación de reparto"} />
      </Card>
      {!profile && (
        <Card>
          <Text style={styles.cardTitle}>Conexión</Text>
          <InfoRow iconName="server-outline" label="Servidor API" value={API_URL} />
          <InfoRow
            iconName={serviceStatus === "ok" ? "checkmark-circle-outline" : serviceStatus === "error" ? "alert-circle-outline" : "help-circle-outline"}
            label="Estado"
            value={serviceStatus === "ok" ? "Conectado" : serviceStatus === "error" ? "Sin conexión" : "Sin verificar"}
          />
          <Button label={checking ? "Verificando…" : "Probar conexión"} icon="pulse-outline" variant="secondary" disabled={checking} onPress={() => void checkConnection()} />
        </Card>
      )}
      <Button label="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={onLogout} />
    </ScrollView>
  );
}

function ReportMetric({ iconName, value, label, tone }: { iconName: keyof typeof Ionicons.glyphMap; value: string | number; label: string; tone: string }) {
  return <Card style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}>{icon(iconName, 22, tone)}</View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Card>;
}

function InfoRow({ iconName, label, value }: { iconName: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.dataRow}><View style={styles.iconBox}>{icon(iconName)}</View><View style={styles.flex}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View></View>;
}

function Empty({ iconName, text }: { iconName: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.empty}>{icon(iconName, 36, colors.muted)}<Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  flex: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 10 },
  cardTitleNoMargin: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  notification: { minHeight: 78, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  notificationUnread: { backgroundColor: "#F8FBFF", marginHorizontal: -10, paddingHorizontal: 10, borderRadius: 10 },
  unreadTitle: { color: colors.blue },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  time: { color: colors.muted, fontSize: 10, marginTop: 5 },
  liveRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.softGreen },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  liveText: { color: colors.green, fontSize: 10, fontWeight: "900" },
  activitySummary: { flexDirection: "row", alignItems: "center", gap: 12 },
  activitySummaryIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.softBlue },
  activityRow: { minHeight: 88, flexDirection: "row", alignItems: "flex-start", gap: 12, position: "relative", paddingBottom: 14 },
  activityLine: { position: "absolute", left: 20, top: 42, bottom: 0, width: 2, backgroundColor: colors.border },
  activityIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", zIndex: 1 },
  activityText: { color: colors.ink, fontSize: 13, lineHeight: 19, paddingTop: 2 },
  activityActor: { fontWeight: "900" },
  activityMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 7 },
  entityTag: { color: colors.blue, backgroundColor: colors.softBlue, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 9, fontWeight: "800", overflow: "hidden" },
  dataRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#EDF2F7", paddingVertical: 9 },
  count: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexGrow: 1, flexBasis: "46%", maxWidth: "49%", minHeight: 132, padding: 14 },
  metricIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  metricValue: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 3 },
  progress: { height: 12, overflow: "hidden", borderRadius: 999, backgroundColor: colors.background },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.green },
  progressText: { color: colors.muted, fontSize: 12, marginTop: 9 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  profileAvatar: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.blue },
  profileInitial: { color: "white", fontSize: 22, fontWeight: "900" },
  profileName: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  infoLabel: { color: colors.muted, fontSize: 11 },
  infoValue: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 2 },
  empty: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 13 },
});
