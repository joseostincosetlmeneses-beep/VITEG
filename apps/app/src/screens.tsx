import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DashboardSummary, SessionUser } from "@viteg/shared";
import { api } from "./api";
import { Button, Card, Field, Loading, SectionTitle, StatusPill } from "./components";
import { colors, radius } from "./theme";
import { RouteMap, type RouteMapPoint } from "./RouteMap";
import { MapboxPlaceSearch, type MapboxPlace } from "./MapboxPlaceSearch";
import { RoutePointPickerModal } from "./RoutePointPickerModal";

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
  const [drivers, setDrivers] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [selectedStops, setSelectedStops] = useState<any[]>([]);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [nextRoutes, nextDrivers, nextAddresses] = await Promise.all([
        api.routes(),
        driver ? Promise.resolve([]) : api.drivers(),
        driver ? Promise.resolve([]) : api.addresses()
      ]);
      setRoutes(nextRoutes);
      setDrivers(nextDrivers.filter((item) => item.status === "ACTIVE"));
      setAddresses(nextAddresses.filter((item) => item.status === "ACTIVE"));
      if (selectedRoute) {
        setSelectedRoute(nextRoutes.find((item) => item._id === selectedRoute._id) ?? null);
      }
    } catch (error) {
      Alert.alert("Rutas", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [driver, selectedRoute?._id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedRoute) {
      setSelectedStops([]);
      return;
    }
    void api.routeStops(selectedRoute._id)
      .then(setSelectedStops)
      .catch((error) => Alert.alert("Mapa de ruta", error instanceof Error ? error.message : String(error)));
  }, [selectedRoute?._id]);
  const updateStatus = async (route: any) => {
    const next = route.status === "ASSIGNED" ? "IN_PROGRESS" : route.status === "IN_PROGRESS" ? "COMPLETED" : null;
    if (!next) return;
    try { await api.updateRouteStatus(route._id, next); await load(); } catch (error) { Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : String(error)); }
  };
  const removeRoute = (route: any) => {
    Alert.alert(
      "Eliminar ruta",
      `Se eliminará “${route.name}” y sus paradas. Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void api.deleteRoute(route._id)
            .then(() => {
              if (selectedRoute?._id === route._id) setSelectedRoute(null);
              return load();
            })
            .catch((error) => Alert.alert("No se pudo eliminar", error instanceof Error ? error.message : String(error)))
        }
      ]
    );
  };
  const plannedWaypoints = Array.isArray(selectedRoute?.waypoints) ? selectedRoute.waypoints : [];
  const mapPoints: RouteMapPoint[] = selectedRoute
    ? [
        ...(selectedRoute.origin ? [{
          id: `${selectedRoute._id}-origin`,
          label: selectedRoute.origin.label,
          coordinates: [selectedRoute.origin.longitude, selectedRoute.origin.latitude] as [number, number],
          sequence: 0,
          kind: "origin" as const
        }] : []),
        ...plannedWaypoints.map((point: MapboxPlace, index: number) => ({
          id: `${selectedRoute._id}-waypoint-${index}`,
          label: point.label,
          coordinates: [point.longitude, point.latitude] as [number, number],
          sequence: index + 1,
          kind: "stop" as const
        })),
        ...selectedStops.flatMap((stop) => {
        const location = stop.addressId?.location;
        return typeof location?.latitude === "number" && typeof location?.longitude === "number"
          ? [{ id: stop._id, label: stop.addressId.alias ?? `Parada ${stop.sequence}`, coordinates: [location.longitude, location.latitude] as [number, number], sequence: plannedWaypoints.length + stop.sequence, kind: "stop" as const }]
          : [];
        }),
        ...(selectedRoute.destination ? [{
          id: `${selectedRoute._id}-destination`,
          label: selectedRoute.destination.label,
          coordinates: [selectedRoute.destination.longitude, selectedRoute.destination.latitude] as [number, number],
          sequence: plannedWaypoints.length + selectedStops.length + 1,
          kind: "destination" as const
        }] : [])
      ]
    : addresses.flatMap((address) => {
        const location = address.location;
        return typeof location?.latitude === "number" && typeof location?.longitude === "number"
          ? [{ id: address._id, label: address.alias, coordinates: [location.longitude, location.latitude] as [number, number] }]
          : [];
      });
  if (loading) return <Loading />;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle
        title={driver ? "Mi ruta" : "Rutas"}
        subtitle={driver ? "Tu jornada y próximas paradas" : "Planeación, asignación y seguimiento con Mapbox"}
        action={!driver ? (
          <Button
            label="Nueva"
            icon="add"
            onPress={() => {
              setEditingRoute(null);
              setFormVisible(true);
            }}
          />
        ) : undefined}
      />
      {!driver && (
        <Card style={styles.mapCard}>
          <View style={styles.cardHeading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{selectedRoute ? selectedRoute.name : "Mapa de cobertura"}</Text>
              <Text style={styles.cardSubtitle}>
                {selectedRoute ? "Paradas ordenadas y recorrido por calles" : "Domicilios disponibles para planear rutas"}
              </Text>
            </View>
            <View style={styles.mapHeaderActions}>
              {selectedRoute && (
                <Pressable style={styles.mapReset} onPress={() => setSelectedRoute(null)}>
                  {icon("close", 18, colors.blue)}
                  <Text style={styles.mapResetText}>Ver todos</Text>
                </Pressable>
              )}
              <Pressable style={styles.mapExpand} onPress={() => setMapFullscreen(true)}>
                {icon("expand-outline", 19, "white")}
                <Text style={styles.mapExpandText}>Ampliar</Text>
              </Pressable>
            </View>
          </View>
          <RouteMap points={mapPoints} />
          <Text style={styles.mapHelp}>Toca “Ampliar” para mover el mapa, acercar con dos dedos y revisar toda la ruta.</Text>
        </Card>
      )}
      {routes.length === 0 ? <Card><Empty text="No hay rutas disponibles." /></Card> : routes.map((route) => (
        <Card key={route._id} style={[styles.routeCard, selectedRoute?._id === route._id ? styles.routeCardSelected : {}]}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}><Text style={styles.routeName}>{route.name}</Text><Text style={styles.rowMeta}>{new Date(route.date).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</Text></View>
            <StatusPill value={route.status} />
          </View>
          {(route.origin || route.destination) && (
            <View style={styles.routeEndpoints}>
              <View style={styles.endpointRow}>{icon("radio-button-on", 15, colors.green)}<Text numberOfLines={1} style={styles.endpointText}>{route.origin?.label ?? "Sin origen"}</Text></View>
              <View style={styles.endpointLine} />
              <View style={styles.endpointRow}>{icon("location", 16, colors.red)}<Text numberOfLines={1} style={styles.endpointText}>{route.destination?.label ?? "Sin destino"}</Text></View>
            </View>
          )}
          <View style={styles.routeStats}>
            <SmallStat iconName="location-outline" value={`${route.completedStopCount}/${(route.stopCount ?? 0) + (route.waypoints?.length ?? 0)}`} label="Paradas" />
            <SmallStat iconName="time-outline" value={route.startTime ?? "--:--"} label="Salida" />
            <SmallStat iconName="car-outline" value={route.vehicleLabel ?? "Sin unidad"} label="Vehículo" />
          </View>
          {driver && ["ASSIGNED", "IN_PROGRESS"].includes(route.status) && (
            <Button label={route.status === "ASSIGNED" ? "Iniciar ruta" : "Finalizar ruta"} icon={route.status === "ASSIGNED" ? "play" : "flag"} onPress={() => void updateStatus(route)} />
          )}
          {!driver && (
            <View style={styles.routeActions}>
              <Pressable
                style={styles.routeAction}
                onPress={() => {
                  setSelectedRoute(route);
                  setMapFullscreen(true);
                }}
              >
                {icon("map-outline", 18, colors.blue)}
                <Text style={styles.routeActionText}>Mapa</Text>
              </Pressable>
              <Pressable
                style={styles.routeAction}
                onPress={() => {
                  setEditingRoute(route);
                  setFormVisible(true);
                }}
              >
                {icon("create-outline", 18, colors.blue)}
                <Text style={styles.routeActionText}>Editar</Text>
              </Pressable>
              <Pressable style={[styles.routeAction, styles.routeActionDanger]} onPress={() => removeRoute(route)}>
                {icon("trash-outline", 18, colors.red)}
                <Text style={[styles.routeActionText, { color: colors.red }]}>Eliminar</Text>
              </Pressable>
            </View>
          )}
        </Card>
      ))}
      {!driver && (
        <RouteFormModal
          visible={formVisible}
          route={editingRoute}
          drivers={drivers}
          onClose={() => setFormVisible(false)}
          onSaved={() => {
            setFormVisible(false);
            void load();
          }}
        />
      )}
      {!driver && (
        <Modal
          visible={mapFullscreen}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setMapFullscreen(false)}
        >
          <SafeAreaView style={styles.fullscreenMapRoot}>
            <View style={styles.fullscreenMapHeader}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.fullscreenMapTitle}>
                  {selectedRoute?.name ?? "Mapa de cobertura"}
                </Text>
                <Text style={styles.fullscreenMapSubtitle}>
                  {selectedRoute ? `${mapPoints.length} puntos · recorrido por calles` : "Domicilios disponibles"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar mapa de pantalla completa"
                style={styles.fullscreenClose}
                onPress={() => setMapFullscreen(false)}
              >
                {icon("close", 25, colors.ink)}
              </Pressable>
            </View>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.green }]} /><Text style={styles.legendText}>Origen</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.amber }]} /><Text style={styles.legendText}>Paradas</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.red }]} /><Text style={styles.legendText}>Destino</Text></View>
            </View>
            <RouteMap points={mapPoints} fullScreen />
          </SafeAreaView>
        </Modal>
      )}
    </ScrollView>
  );
}

function RouteFormModal({
  visible,
  route,
  drivers,
  onClose,
  onSaved
}: {
  visible: boolean;
  route: any | null;
  drivers: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("08:00");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [driverId, setDriverId] = useState("");
  const [origin, setOrigin] = useState<MapboxPlace | null>(null);
  const [destination, setDestination] = useState<MapboxPlace | null>(null);
  const [waypoints, setWaypoints] = useState<MapboxPlace[]>([]);
  const [stopCandidate, setStopCandidate] = useState<MapboxPlace | null>(null);
  const [pointPickerVisible, setPointPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(route?.name ?? "");
    setDate(route?.date ? new Date(route.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setStartTime(route?.startTime ?? "08:00");
    setVehicleLabel(route?.vehicleLabel ?? "");
    setDriverId(typeof route?.driverId === "string" ? route.driverId : route?.driverId?._id ?? "");
    setOrigin(route?.origin ?? null);
    setDestination(route?.destination ?? null);
    setWaypoints(Array.isArray(route?.waypoints) ? route.waypoints : []);
    setStopCandidate(null);
  }, [visible, route]);

  const save = async () => {
    if (name.trim().length < 3) {
      Alert.alert("Ruta", "Escribe un nombre de al menos 3 caracteres");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert("Ruta", "La fecha debe tener el formato AAAA-MM-DD");
      return;
    }
    if (!origin || !destination) {
      Alert.alert("Ruta", "Selecciona el punto de salida y el punto final en Mapbox");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        date: `${date}T12:00:00`,
        startTime: startTime.trim() || undefined,
        vehicleLabel: vehicleLabel.trim() || undefined,
        driverId: driverId || null,
        origin,
        destination,
        waypoints
      };
      if (route) await api.updateRoute(route._id, payload);
      else await api.createRoute(payload);
      onSaved();
    } catch (error) {
      Alert.alert("No se pudo guardar", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.cardHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{route ? "Editar ruta" : "Nueva ruta"}</Text>
                <Text style={styles.cardSubtitle}>Programa la unidad y asigna un repartidor</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={onClose}>{icon("close", 24, colors.ink)}</Pressable>
            </View>
            <Field label="Nombre de la ruta" value={name} onChangeText={setName} placeholder="Ej. Ruta Centro" />
            <Field label="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-05" autoCapitalize="none" />
            <Field label="Hora de salida" value={startTime} onChangeText={setStartTime} placeholder="08:00" autoCapitalize="none" />
            <View style={styles.routePointSection}>
              <View>
                <Text style={styles.cardTitle}>Puntos del recorrido</Text>
                <Text style={styles.cardSubtitle}>Usa el buscador o fija cualquier coordenada directamente.</Text>
              </View>
              <Pressable style={styles.pickOnMapButton} onPress={() => setPointPickerVisible(true)}>
                {icon("map-outline", 21, "white")}
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickOnMapTitle}>Seleccionar directamente en el mapa</Text>
                  <Text style={styles.pickOnMapSubtitle}>Origen, paradas y destino aunque el lugar no aparezca</Text>
                </View>
                {icon("chevron-forward", 20, "white")}
              </Pressable>
              <MapboxPlaceSearch label="Punto de salida" value={origin} onChange={setOrigin} />
              <MapboxPlaceSearch label="Buscar una parada intermedia" value={stopCandidate} onChange={setStopCandidate} />
              {stopCandidate && (
                <Pressable
                  style={styles.addStopButton}
                  onPress={() => {
                    if (waypoints.length >= 23) {
                      Alert.alert("Límite de paradas", "Una ruta puede contener hasta 23 paradas intermedias.");
                      return;
                    }
                    setWaypoints([...waypoints, stopCandidate]);
                    setStopCandidate(null);
                  }}
                >
                  {icon("add-circle", 19, colors.blue)}
                  <Text style={styles.addStopText}>Añadir como parada {waypoints.length + 1}</Text>
                </Pressable>
              )}
              {waypoints.length > 0 && (
                <View style={styles.waypointList}>
                  <Text style={styles.waypointListTitle}>{waypoints.length} parada{waypoints.length === 1 ? "" : "s"} intermedia{waypoints.length === 1 ? "" : "s"}</Text>
                  {waypoints.map((point, index) => (
                    <View key={`${point.latitude}-${point.longitude}-${index}`} style={styles.waypointRow}>
                      <View style={styles.waypointNumber}><Text style={styles.waypointNumberText}>{index + 1}</Text></View>
                      <Text numberOfLines={2} style={styles.waypointText}>{point.label}</Text>
                      <Pressable onPress={() => setWaypoints(waypoints.filter((_, itemIndex) => itemIndex !== index))}>
                        {icon("trash-outline", 19, colors.red)}
                      </Pressable>
                    </View>
                  ))}
                  <Pressable style={styles.reorderButton} onPress={() => setPointPickerVisible(true)}>
                    {icon("swap-vertical-outline", 18, colors.blue)}
                    <Text style={styles.reorderText}>Ordenar paradas en el mapa</Text>
                  </Pressable>
                </View>
              )}
              <MapboxPlaceSearch label="Punto final" value={destination} onChange={setDestination} />
            </View>
            <Field label="Camioneta o unidad" value={vehicleLabel} onChangeText={setVehicleLabel} placeholder="Ej. Nissan NP300 · VITEG-01" />
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Asignar repartidor</Text>
              <Pressable style={[styles.driverOption, !driverId && styles.driverOptionSelected]} onPress={() => setDriverId("")}>
                {icon("person-remove-outline", 19, !driverId ? "white" : colors.blue)}
                <Text style={[styles.driverOptionText, !driverId && styles.driverOptionTextSelected]}>Sin asignar</Text>
              </Pressable>
              {drivers.map((item) => {
                const selected = driverId === item._id;
                return (
                  <Pressable key={item._id} style={[styles.driverOption, selected && styles.driverOptionSelected]} onPress={() => setDriverId(item._id)}>
                    {icon("car-outline", 19, selected ? "white" : colors.blue)}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.driverOptionText, selected && styles.driverOptionTextSelected]}>{item.firstName} {item.lastName}</Text>
                      <Text style={[styles.driverOptionMeta, selected && styles.driverOptionTextSelected]}>{item.phone ?? item.email}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Button label={saving ? "Guardando…" : route ? "Guardar cambios" : "Crear ruta"} icon="save-outline" disabled={saving} onPress={() => void save()} />
          </ScrollView>
        </View>
      </View>
      <RoutePointPickerModal
        visible={pointPickerVisible}
        origin={origin}
        destination={destination}
        waypoints={waypoints}
        onOriginChange={setOrigin}
        onDestinationChange={setDestination}
        onWaypointsChange={setWaypoints}
        onClose={() => setPointPickerVisible(false)}
      />
    </Modal>
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
  page: { padding: 16, gap: 14, width: "100%", alignSelf: "center" },
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
  mapCard: { padding: 12, marginBottom: 2 },
  mapHeaderActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 7, marginLeft: 8 },
  mapReset: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.softBlue },
  mapResetText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  mapExpand: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.blue },
  mapExpandText: { color: "white", fontSize: 12, fontWeight: "900" },
  mapHelp: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 8 },
  fullscreenMapRoot: { flex: 1, backgroundColor: "white" },
  fullscreenMapHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: colors.border },
  fullscreenMapTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  fullscreenMapSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  fullscreenClose: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  mapLegend: { flexDirection: "row", justifyContent: "center", gap: 18, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: colors.border },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "white" },
  legendText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routeName: { fontSize: 19, fontWeight: "900", color: colors.ink },
  routeStats: { flexDirection: "row", flexWrap: "wrap", gap: 22, paddingVertical: 18 },
  routeCard: { marginBottom: 12 },
  routeCardSelected: { borderColor: colors.blue, borderWidth: 2 },
  routeEndpoints: { marginTop: 14, padding: 12, borderRadius: 11, backgroundColor: colors.background },
  endpointRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  endpointText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: "700" },
  endpointLine: { width: 2, height: 12, marginLeft: 6, marginVertical: 2, backgroundColor: colors.border },
  routeActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  routeAction: { minHeight: 40, paddingHorizontal: 12, borderRadius: 9, backgroundColor: colors.softBlue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  routeActionDanger: { backgroundColor: colors.softRed },
  routeActionText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,42,67,0.45)" },
  modalCard: { maxHeight: "92%", backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  modalContent: { padding: 20, paddingBottom: 36, gap: 16 },
  modalTitle: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  modalClose: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "white" },
  routePointSection: { gap: 12, padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "white" },
  pickOnMapButton: { minHeight: 68, paddingHorizontal: 13, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.blue, flexDirection: "row", alignItems: "center", gap: 10 },
  pickOnMapTitle: { color: "white", fontSize: 13, fontWeight: "900" },
  pickOnMapSubtitle: { color: "#D9EAFB", fontSize: 10, lineHeight: 15, marginTop: 2 },
  addStopButton: { minHeight: 44, borderRadius: radius.sm, backgroundColor: colors.softBlue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  addStopText: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  waypointList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: "hidden" },
  waypointListTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.background },
  waypointRow: { minHeight: 50, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: colors.border },
  waypointNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber },
  waypointNumberText: { color: "white", fontSize: 11, fontWeight: "900" },
  waypointText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  reorderButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.softBlue },
  reorderText: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  driverOption: { minHeight: 54, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: "white", flexDirection: "row", alignItems: "center", gap: 10 },
  driverOptionSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  driverOptionText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  driverOptionTextSelected: { color: "white" },
  driverOptionMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
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
