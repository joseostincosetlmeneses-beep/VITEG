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
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { SessionUser } from "@viteg/shared";
import { api } from "./src/api";
import { Button, Field } from "./src/components";
import { AdminDashboard, DriverHome, ResourceScreen, RoutesScreen } from "./src/screens";
import { colors, radius } from "./src/theme";

const logo = require("./assets/viteg-logo.png");

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const adminTabs: NavItem[] = [
  { label: "Inicio", icon: "home-outline" },
  { label: "Rutas", icon: "map-outline" },
  { label: "Clientes", icon: "people-outline" },
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
  { label: "Agenda", icon: "calendar-outline" },
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
  { label: "Nuevo domicilio", icon: "add-circle-outline" },
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
  const [email, setEmail] = useState("admin@viteg.mx");
  const [password, setPassword] = useState("Viteg2026!");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      onSuccess(await api.login(email, password));
    } catch (error) {
      Alert.alert(
        "No se pudo iniciar sesión",
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
          <Text style={styles.welcome}>Bienvenido</Text>
          <Text style={styles.loginSubtitle}>
            Gestiona tus rutas y entregas desde VITEG
          </Text>
          <View style={styles.form}>
            <Field
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Button
              label={loading ? "Ingresando…" : "Iniciar sesión"}
              icon="log-in-outline"
              disabled={loading}
              onPress={() => void submit()}
            />
          </View>
          <Text style={styles.mobileCaption}>Aplicación móvil para Android</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
      : current === "Más"
        ? <MoreMenu items={moreItems} onNavigate={setCurrent} onLogout={onLogout} />
        : <ResourceScreen name={current} />;

  return (
    <SafeAreaView style={styles.workspace}>
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
