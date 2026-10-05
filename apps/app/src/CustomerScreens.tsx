import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "./api";
import { Button, Card, Field, Loading, SectionTitle, StatusPill } from "./components";
import { LocationPickerModal } from "./LocationPickerModal";
import { MapboxPlaceSearch, type MapboxPlace } from "./MapboxPlaceSearch";
import { colors, radius } from "./theme";

type CustomerFormValue = {
  name: string;
  phone: string;
  description: string;
  location: MapboxPlace | null;
};

const emptyValue = (): CustomerFormValue => ({ name: "", phone: "", description: "", location: null });

function customerName(customer: any) {
  return customer.name || customer.businessName || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Cliente";
}

function valueFromCustomer(customer: any): CustomerFormValue {
  const address = customer.address;
  return {
    name: customerName(customer),
    phone: customer.phone ?? "",
    description: address?.reference ?? customer.notes ?? "",
    location: typeof address?.location?.latitude === "number" && typeof address?.location?.longitude === "number"
      ? { label: address.street || address.alias, latitude: address.location.latitude, longitude: address.location.longitude }
      : null
  };
}

export function ClientsScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await api.list("/customers")); }
    catch (error) { Alert.alert("Clientes", error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading && customers.length === 0) return <Loading />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.page}>
      <SectionTitle
        title="Clientes"
        subtitle="Puntos de entrega disponibles para las rutas"
        action={<Button label="Nuevo" icon="add" onPress={() => { setEditing(null); setFormVisible(true); }} />}
      />
      {customers.length === 0 ? (
        <Card><Text style={styles.empty}>Todavía no hay clientes registrados.</Text></Card>
      ) : customers.map((customer) => (
        <Card key={customer._id} style={styles.customerCard}>
          <View style={styles.cardTop}>
            <View style={styles.customerIcon}><Ionicons name="storefront-outline" size={22} color={colors.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customerName(customer)}</Text>
              <Text style={styles.phone}>{customer.phone}</Text>
            </View>
            <StatusPill value={customer.status ?? "ACTIVE"} />
          </View>
          <View style={styles.addressBox}>
            <Ionicons name="location" size={18} color={colors.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{customer.address?.street ?? "Ubicación pendiente"}</Text>
              <Text style={styles.description}>{customer.address?.reference ?? customer.notes ?? "Sin referencias"}</Text>
            </View>
          </View>
          <Button label="Editar cliente" variant="secondary" icon="create-outline" onPress={() => { setEditing(customer); setFormVisible(true); }} />
        </Card>
      ))}
      <CustomerFormModal
        visible={formVisible}
        customer={editing}
        onClose={() => setFormVisible(false)}
        onSaved={() => { setFormVisible(false); void load(); }}
      />
    </ScrollView>
  );
}

function CustomerFormModal({ visible, customer, onClose, onSaved }: { visible: boolean; customer: any | null; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<CustomerFormValue>(emptyValue);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) setValue(customer ? valueFromCustomer(customer) : emptyValue());
  }, [visible, customer]);
  const save = async () => {
    if (!value.name.trim() || value.phone.trim().length < 7 || !value.description.trim() || !value.location) {
      Alert.alert("Datos incompletos", "Indica nombre, teléfono, descripción y ubicación exacta del cliente.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...value, name: value.name.trim(), phone: value.phone.trim(), description: value.description.trim(), location: value.location };
      if (customer) await api.update(`/customers/${customer._id}`, payload);
      else await api.create("/customers", payload);
      onSaved();
    } catch (error) {
      Alert.alert("No se pudo guardar", error instanceof Error ? error.message : String(error));
    } finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}><Text style={styles.modalTitle}>{customer ? "Editar cliente" : "Nuevo cliente"}</Text><Text style={styles.description}>Solo los administradores pueden modificar estos datos.</Text></View>
              <Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={24} color={colors.ink} /></Pressable>
            </View>
            <CustomerFields value={value} onChange={setValue} />
            <Button label={saving ? "Guardando…" : "Guardar cliente"} icon="save-outline" disabled={saving} onPress={() => void save()} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CustomerFields({ value, onChange }: { value: CustomerFormValue; onChange: (value: CustomerFormValue) => void }) {
  const [mapVisible, setMapVisible] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Field label="Nombre del cliente o sucursal" value={value.name} onChangeText={(name) => onChange({ ...value, name })} placeholder="Ej. Abarrotes Lupita · Sucursal Centro" />
      <Field label="Teléfono de contacto" value={value.phone} onChangeText={(phone) => onChange({ ...value, phone })} placeholder="246 000 0000" keyboardType="phone-pad" />
      <Field label="Descripción y referencias del domicilio" value={value.description} onChangeText={(description) => onChange({ ...value, description })} placeholder="Ej. Portón azul, frente a la iglesia" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 84, paddingTop: 12 }} />
      <MapboxPlaceSearch label="Buscar ubicación" value={value.location} onChange={(location) => onChange({ ...value, location })} />
      <Pressable style={styles.mapButton} onPress={() => setMapVisible(true)}>
        <Ionicons name="map-outline" size={21} color="white" />
        <View style={{ flex: 1 }}><Text style={styles.mapButtonTitle}>Fijar ubicación directamente en el mapa</Text><Text style={styles.mapButtonText}>Para domicilios que no aparecen en el buscador</Text></View>
        <Ionicons name="chevron-forward" size={20} color="white" />
      </Pressable>
      <LocationPickerModal visible={mapVisible} title="Ubicación del cliente" value={value.location} onChange={(location) => onChange({ ...value, location })} onClose={() => setMapVisible(false)} />
    </View>
  );
}

export function CustomerRequestScreen() {
  const [value, setValue] = useState<CustomerFormValue>(emptyValue);
  const [requests, setRequests] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api.list("/address-requests").then(setRequests).catch((error) => Alert.alert("Solicitudes", error.message)), []);
  useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    if (!value.name.trim() || value.phone.trim().length < 7 || !value.description.trim() || !value.location) {
      Alert.alert("Datos incompletos", "Indica nombre, teléfono, descripción y ubicación exacta del cliente.");
      return;
    }
    setSaving(true);
    try {
      await api.create("/address-requests", {
        customerData: { type: "NEGOCIO", businessName: value.name.trim(), phone: value.phone.trim() },
        addressData: {
          alias: value.name.trim(), street: value.location.label, exteriorNumber: "S/N",
          neighborhood: "No especificada", city: "Huamantla", state: "Tlaxcala", reference: value.description.trim()
        },
        coordinates: { latitude: value.location.latitude, longitude: value.location.longitude },
        notes: value.description.trim(), photos: []
      });
      setValue(emptyValue());
      await load();
      Alert.alert("Solicitud enviada", "El administrador revisará los datos antes de crear el cliente.");
    } catch (error) { Alert.alert("No se pudo enviar", error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <SectionTitle title="Solicitar nuevo cliente" subtitle="El administrador debe aprobarlo antes de usarlo como parada" />
      <Card style={{ gap: 16 }}><CustomerFields value={value} onChange={setValue} /><Button label={saving ? "Enviando…" : "Enviar solicitud"} icon="send-outline" disabled={saving} onPress={() => void submit()} /></Card>
      <SectionTitle title="Mis solicitudes" />
      {requests.length === 0 ? <Card><Text style={styles.empty}>No has enviado solicitudes.</Text></Card> : requests.map((request) => (
        <Card key={request._id} style={styles.requestCard}>
          <View style={styles.cardTop}><Text style={[styles.customerName, { flex: 1 }]}>{request.customerData?.businessName || request.addressData?.alias}</Text><StatusPill value={request.status} /></View>
          <Text style={styles.phone}>{request.customerData?.phone}</Text>
          <Text style={styles.description}>{request.addressData?.reference}</Text>
          {request.rejectionReason && <Text style={styles.rejection}>Motivo: {request.rejectionReason}</Text>}
        </Card>
      ))}
    </ScrollView>
  );
}

export function RequestsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { setRequests(await api.list("/address-requests")); }
    catch (error) { Alert.alert("Solicitudes", error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const review = async (request: any, status: "APPROVED" | "REJECTED", rejectionReason?: string) => {
    try {
      await api.update(`/address-requests/${request._id}/review`, { status, rejectionReason });
      setRejecting(null); setReason(""); await load();
    } catch (error) { Alert.alert("No se pudo revisar", error instanceof Error ? error.message : String(error)); }
  };
  if (loading && requests.length === 0) return <Loading />;
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.page}>
      <SectionTitle title="Solicitudes de clientes" subtitle="Aprueba o rechaza los puntos enviados por repartidores" />
      {requests.length === 0 ? <Card><Text style={styles.empty}>No hay solicitudes.</Text></Card> : requests.map((request) => (
        <Card key={request._id} style={styles.requestCard}>
          <View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.customerName}>{request.customerData?.businessName || request.addressData?.alias}</Text><Text style={styles.phone}>{request.customerData?.phone}</Text></View><StatusPill value={request.status} /></View>
          <Text style={styles.addressLabel}>{request.addressData?.street}</Text>
          <Text style={styles.description}>{request.addressData?.reference || request.notes}</Text>
          <Text style={styles.requestedBy}>Enviada por: {request.requestedBy?.firstName} {request.requestedBy?.lastName}</Text>
          {request.status === "PENDING" && <View style={styles.actions}><Button label="Aprobar" icon="checkmark" onPress={() => void review(request, "APPROVED")} /><Button label="Rechazar" variant="danger" icon="close" onPress={() => setRejecting(request)} /></View>}
          {request.rejectionReason && <Text style={styles.rejection}>Motivo: {request.rejectionReason}</Text>}
        </Card>
      ))}
      <Modal visible={Boolean(rejecting)} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={[styles.overlay, { justifyContent: "center", padding: 20 }]}><Card style={{ gap: 14 }}><Text style={styles.modalTitle}>Rechazar solicitud</Text><Field label="Motivo del rechazo" value={reason} onChangeText={setReason} placeholder="Explica qué dato debe corregirse" /><View style={styles.actions}><Button label="Cancelar" variant="secondary" onPress={() => setRejecting(null)} /><Button label="Confirmar rechazo" variant="danger" disabled={reason.trim().length < 3} onPress={() => void review(rejecting, "REJECTED", reason.trim())} /></View></Card></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, width: "100%", alignSelf: "center" },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 28 },
  customerCard: { gap: 13, marginBottom: 2 },
  requestCard: { gap: 9 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  customerIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.softBlue, alignItems: "center", justifyContent: "center" },
  customerName: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  phone: { color: colors.blue, fontSize: 12, fontWeight: "800", marginTop: 2 },
  addressBox: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 11, borderRadius: radius.sm, backgroundColor: colors.background },
  addressLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  requestedBy: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  rejection: { color: colors.red, fontSize: 11, fontWeight: "800", padding: 9, borderRadius: 8, backgroundColor: colors.softRed },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,42,67,0.48)" },
  modalCard: { maxHeight: "92%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, overflow: "hidden" },
  form: { padding: 20, paddingBottom: 36, gap: 16 },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  close: { width: 42, height: 42, borderRadius: 12, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  mapButton: { minHeight: 64, padding: 12, borderRadius: radius.sm, backgroundColor: colors.blue, flexDirection: "row", alignItems: "center", gap: 9 },
  mapButtonTitle: { color: "white", fontSize: 12, fontWeight: "900" },
  mapButtonText: { color: "#D9EAFB", fontSize: 10, marginTop: 2 }
});
