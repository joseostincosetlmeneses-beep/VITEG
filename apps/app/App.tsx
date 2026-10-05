import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { Role, SessionUser } from "@viteg/shared";
import { api } from "./src/api";
import { Button, Field } from "./src/components";
import { AdminDashboard, DriverHome, ResourceScreen, RoutesScreen } from "./src/screens";
import { ClientsScreen, CustomerRequestScreen, RequestsScreen } from "./src/CustomerScreens";
import { DriverLocationReporter } from "./src/DriverLocationReporter";
import { AgendaScreen } from "./src/AgendaScreen";
import { colors, radius } from "./src/theme";

const logo = require("./assets/viteg-logo.png");

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const adminTabs: NavItem[] = [
  { label: "Inicio", icon: "home-outline" },
  { label: "Rutas", icon: "map-outline" },
  { label: "Agenda", icon: "calendar-outline" },
  { label: "Chat", icon: "chatbubbles-outline" },
  { label: "Más", icon: "grid-outline" }
];

const driverTabs: NavItem[] = [
  { label: "Inicio", icon: "home-outline" },
  { label: "Mi Ruta", icon: "navigate-outline" },
  { label: "Entregas", icon: "checkmark-done-outline" },
  { label: "Chat", icon: "chatbubbles-outline" },
  { label: "Más", icon: "grid-outline" }
];

const adminMore: NavItem[] = [
  { label: "Monitor", icon: "navigate-circle-outline" },
  { label: "Clientes", icon: "people-outline" },
  { label: "Repartidores", icon: "people-outline" },
  { label: "Domicilios", icon: "location-outline" },
  { label: "Zonas", icon: "grid-outline" },
  { label: "Productos", icon: "cube-outline" },
  { label: "Solicitudes", icon: "document-text-outline" },
  { label: "Notificaciones", icon: "notifications-outline" },
  { label: "Reportes", icon: "bar-chart-outline" },
  { label: "Configuración", icon: "settings-outline" }
];

const driverMore: NavItem[] = [
  { label: "Mapa", icon: "map-outline" },
  { label: "Nuevo cliente", icon: "add-circle-outline" },
  { label: "Notificaciones", icon: "notifications-outline" },
  { label: "Perfil", icon: "person-circle-outline" }
];

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    void api.restore().then(setUser).finally(() => setRestoring(false));
  }, []);

  if (restoring) {
    return (
      <SafeAreaView style={styles.splash}>
        <StatusBar style="dark" />
        <Image source={logo} resizeMode="contain" style={styles.splashLogo} />
        <ActivityIndicator color={colors.sky} size="large" />
      </SafeAreaView>
    );
  }

  if (!user) return <Login onSuccess={setUser} />;

  return (
    <Workspace
      user={user}
      onLogout={() => void api.logout().then(() => setUser(null))}
    />
  );
}

function Login({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("admin@viteg.mx");
  const [password, setPassword] = useState("Viteg2026!");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [loading, setLoading] = useState(false);

  const selectRole = (nextRole: Role) => {
    setRole(nextRole);
    if (email === "admin@viteg.mx" || email === "repartidor@viteg.mx") {
      setEmail(nextRole === "ADMIN" ? "admin@viteg.mx" : "repartidor@viteg.mx");
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "login") {
        onSuccess(await api.login(email, password, role));
        return;
      }
      if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
        throw new Error("Completa todos los campos");
      }
      if (password.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres");
      }
      if (password !== confirmPassword) {
        throw new Error("Las contraseñas no coinciden");
      }
      await api.register({ firstName, lastName, phone, email, password });
      Alert.alert(
        "Registro enviado",
        "Tu cuenta quedó pendiente de autorización. Un administrador debe activarla antes de que puedas iniciar sesión."
      );
      setMode("login");
      setConfirmPassword("");
    } catch (error) {
      Alert.alert(
        mode === "login" ? "No se pudo iniciar sesión" : "No se pudo completar el registro",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginRoot}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.loginKeyboard}
      >
        <ScrollView
          contentContainerStyle={styles.loginContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoCard}>
            <Image source={logo} resizeMode="contain" style={styles.loginLogo} />
          </View>
          <Text style={styles.welcome}>
            {mode === "login" ? "Bienvenido" : "Crea tu cuenta"}
          </Text>
          <Text style={styles.loginSubtitle}>
            {mode === "login"
              ? "Gestiona tus rutas y entregas desde VITEG"
              : "Regístrate como repartidor para solicitar acceso"}
          </Text>
          <View style={styles.form}>
            {mode === "login" && (
              <View style={styles.roleGroup}>
                <Text style={styles.roleLabel}>Ingresa como</Text>
                <View style={styles.roleOptions}>
                  {([
                    { value: "ADMIN" as const, label: "Administrador", icon: "briefcase-outline" as const },
                    { value: "DRIVER" as const, label: "Repartidor", icon: "car-outline" as const }
                  ]).map((option) => {
                    const selected = role === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => selectRole(option.value)}
                        style={[styles.roleOption, selected && styles.roleOptionSelected]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={21}
                          color={selected ? "white" : colors.blue}
                        />
                        <Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {mode === "register" && (
              <>
                <Field
                  label="Nombre"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
                <Field
                  label="Apellidos"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
                <Field
                  label="Teléfono"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </>
            )}
            <Field
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <SecureField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
            />
            {mode === "register" && (
              <SecureField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            )}
            <Button
              label={loading
                ? mode === "login" ? "Ingresando…" : "Registrando…"
                : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
              icon={mode === "login" ? "log-in-outline" : "person-add-outline"}
              disabled={loading}
              onPress={() => void submit()}
            />
          </View>
          <View style={styles.accountPrompt}>
            <Text style={styles.accountText}>
              {mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes una cuenta?"}
            </Text>
            <Pressable
              onPress={() => {
                setMode(mode === "login" ? "register" : "login");
                setPassword("");
                setConfirmPassword("");
              }}
            >
              <Text style={styles.accountAction}>
                {mode === "login" ? "Regístrate" : "Inicia sesión"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.mobileCaption}>Aplicación móvil para Android</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SecureField({
  label,
  value,
  onChangeText
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.secureGroup}>
      <Text style={styles.secureLabel}>{label}</Text>
      <View style={styles.secureInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Escribe tu contraseña"
          placeholderTextColor="#9FB3C8"
          style={styles.secureInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onPress={() => setVisible((current) => !current)}
          style={styles.eyeButton}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={22}
            color={colors.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

function Workspace({
  user,
  onLogout
}: {
  user: SessionUser;
  onLogout: () => void;
}) {
  const tabs = user.role === "ADMIN" ? adminTabs : driverTabs;
  const moreItems = user.role === "ADMIN" ? adminMore : driverMore;
  const [current, setCurrent] = useState("Inicio");
  const activeTab = useMemo(
    () => (tabs.some((item) => item.label === current) ? current : "Más"),
    [current, tabs]
  );

  const content = current === "Inicio"
    ? user.role === "ADMIN"
      ? <AdminDashboard />
      : <DriverHome user={user} onNavigate={setCurrent} />
    : current === "Rutas" || current === "Mi Ruta"
      ? <RoutesScreen driver={user.role === "DRIVER"} />
      : current === "Clientes" && user.role === "ADMIN"
        ? <ClientsScreen />
        : current === "Agenda" && user.role === "ADMIN"
          ? <AgendaScreen />
        : current === "Solicitudes" && user.role === "ADMIN"
          ? <RequestsScreen />
          : current === "Nuevo cliente" && user.role === "DRIVER"
            ? <CustomerRequestScreen />
      : current === "Más"
        ? <MoreMenu items={moreItems} onNavigate={setCurrent} onLogout={onLogout} />
        : <ResourceScreen name={current} />;

  return (
    <SafeAreaView style={styles.workspace}>
      <DriverLocationReporter enabled={user.role === "DRIVER"} />
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Image source={logo} resizeMode="contain" style={styles.headerLogo} />
        <View style={styles.headerSpacer} />
        <Pressable style={styles.headerButton} onPress={() => setCurrent("Notificaciones")}>
          <Ionicons name="notifications-outline" size={22} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.avatar} onPress={() => setCurrent("Perfil")}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </Pressable>
      </View>
      <View style={styles.screen}>{content}</View>
      <View style={styles.bottomBar}>
        {tabs.map((item) => {
          const active = activeTab === item.label;
          const activeIcon = item.icon.replace("-outline", "") as keyof typeof Ionicons.glyphMap;
          return (
            <Pressable
              key={item.label}
              onPress={() => setCurrent(item.label)}
              style={styles.tab}
            >
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <Ionicons
                  name={active ? activeIcon : item.icon}
                  size={21}
                  color={active ? colors.blue : colors.muted}
                />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function MoreMenu({
  items,
  onNavigate,
  onLogout
}: {
  items: NavItem[];
  onNavigate: (name: string) => void;
  onLogout: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.morePage}>
      <Text style={styles.moreTitle}>Más opciones</Text>
      <Text style={styles.moreSubtitle}>Administración y herramientas de VITEG</Text>
      <View style={styles.moreGrid}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            style={styles.moreItem}
            onPress={() => onNavigate(item.label)}
          >
            <View style={styles.moreIcon}>
              <Ionicons name={item.icon} size={24} color={colors.blue} />
            </View>
            <Text style={styles.moreLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.logout} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={21} color={colors.red} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    backgroundColor: "white"
  },
  splashLogo: { width: 230, height: 130 },
  loginRoot: { flex: 1, backgroundColor: colors.background },
  loginKeyboard: { flex: 1 },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 34
  },
  logoCard: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 30
  },
  loginLogo: { width: 250, height: 138, maxWidth: "88%" },
  welcome: { fontSize: 30, fontWeight: "900", color: colors.ink },
  loginSubtitle: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 7 },
  form: { gap: 16, marginTop: 28 },
  roleGroup: { gap: 8 },
  roleLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  roleOptions: { flexDirection: "row", gap: 10 },
  roleOption: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  roleOptionSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  roleOptionText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  roleOptionTextSelected: { color: "white" },
  secureGroup: { gap: 7 },
  secureLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  secureInputWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: "white"
  },
  secureInput: {
    flex: 1,
    minHeight: 48,
    paddingLeft: 14,
    color: colors.ink
  },
  eyeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  accountPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 22
  },
  accountText: { color: colors.muted, fontSize: 13 },
  accountAction: { color: colors.blue, fontSize: 13, fontWeight: "900" },
  mobileCaption: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24
  },
  workspace: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerLogo: { width: 94, height: 50 },
  headerSpacer: { flex: 1 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: "white", fontWeight: "900", fontSize: 16 },
  screen: { flex: 1 },
  bottomBar: {
    minHeight: 70,
    paddingTop: 7,
    paddingBottom: Platform.OS === "ios" ? 10 : 7,
    paddingHorizontal: 4,
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  tabIcon: {
    minWidth: 40,
    height: 29,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  tabIconActive: { backgroundColor: colors.softBlue },
  tabLabel: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  tabLabelActive: { color: colors.blue, fontWeight: "800" },
  morePage: { padding: 20, paddingBottom: 36 },
  moreTitle: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  moreSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 22 },
  moreGrid: { gap: 10 },
  moreItem: {
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  moreIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center"
  },
  moreLabel: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "800" },
  logout: {
    minHeight: 52,
    marginTop: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: colors.softRed,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9
  },
  logoutText: { color: colors.red, fontSize: 14, fontWeight: "800" }
});
