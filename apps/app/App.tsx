import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { SessionUser } from "@viteg/shared";
import { api } from "./src/api";
import { Button, Field } from "./src/components";
import {
  AdminDashboard,
  DriverHome,
  ResourceScreen,
  RoutesScreen,
  adminNavigation,
  driverNavigation
} from "./src/screens";
import { colors, radius } from "./src/theme";

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => { void api.restore().then(setUser).finally(() => setRestoring(false)); }, []);

  if (restoring) {
    return <View style={styles.splash}><WaterMark /><ActivityIndicator color={colors.sky} /></View>;
  }
  if (!user) return <Login onSuccess={setUser} />;
  return <Workspace user={user} onLogout={() => void api.logout().then(() => setUser(null))} />;
}

function Login({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("admin@viteg.mx");
  const [password, setPassword] = useState("Viteg2026!");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try { onSuccess(await api.login(email, password)); }
    catch (error) { Alert.alert("No se pudo iniciar sesión", error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={styles.loginRoot}>
      <StatusBar style="dark" />
      <View style={styles.loginAccent} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.loginWrap}>
        <View style={styles.brandPanel}>
          <WaterMark large />
          <Text style={styles.brandHeadline}>La operación de reparto,{"\n"}clara y bajo control.</Text>
          <Text style={styles.brandCopy}>Administra rutas, entregas, clientes y comunicación desde un solo lugar.</Text>
          <View style={styles.brandFeature}>{<Ionicons name="navigate-circle-outline" size={24} color={colors.cyan} />}<Text style={styles.brandFeatureText}>Seguimiento operativo en tiempo real</Text></View>
          <View style={styles.brandFeature}>{<Ionicons name="shield-checkmark-outline" size={24} color={colors.cyan} />}<Text style={styles.brandFeatureText}>Acceso seguro por perfil</Text></View>
        </View>
        <View style={styles.loginCard}>
          <Text style={styles.welcome}>Bienvenido</Text>
          <Text style={styles.loginSubtitle}>Ingresa a tu cuenta de VITEG</Text>
          <View style={{ gap: 15, marginTop: 27 }}>
            <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
            <Button label={loading ? "Ingresando…" : "Iniciar sesión"} icon="log-in-outline" disabled={loading} onPress={() => void submit()} />
          </View>
          <View style={styles.demoBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
            <Text style={styles.demoText}>Ejecuta el seed para crear las cuentas demo. También existe repartidor@viteg.mx.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WaterMark({ large = false }: { large?: boolean }) {
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logo, large && styles.logoLarge]}><Ionicons name="water" size={large ? 30 : 22} color="white" /></View>
      <View><Text style={[styles.logoName, large && { fontSize: 29, color: colors.navy }]}>VITEG</Text><Text style={styles.logoTag}>DISTRIBUCIÓN INTELIGENTE</Text></View>
    </View>
  );
}

function Workspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const navigation = user.role === "ADMIN" ? adminNavigation : driverNavigation;
  const [current, setCurrent] = useState("Inicio");
  const [menuOpen, setMenuOpen] = useState(!compact);
  useEffect(() => setMenuOpen(!compact), [compact]);

  const content = current === "Inicio"
    ? user.role === "ADMIN" ? <AdminDashboard /> : <DriverHome user={user} onNavigate={setCurrent} />
    : current === "Rutas" || current === "Mi Ruta"
      ? <RoutesScreen driver={user.role === "DRIVER"} />
      : <ResourceScreen name={current} />;

  return (
    <SafeAreaView style={styles.workspace}>
      <StatusBar style="dark" />
      <View style={styles.appRow}>
        {menuOpen && <Sidebar user={user} current={current} navigation={navigation} onNavigate={(name: string) => { setCurrent(name); if (compact) setMenuOpen(false); }} onLogout={onLogout} compact={compact} />}
        <View style={styles.main}>
          <View style={styles.topbar}>
            <Pressable onPress={() => setMenuOpen((value) => !value)} style={styles.iconButton}><Ionicons name="menu" size={23} color={colors.ink} /></Pressable>
            <View style={{ flex: 1 }}><Text style={styles.breadcrumb}>{current}</Text><Text style={styles.breadcrumbMeta}>{user.role === "ADMIN" ? "Administración" : "Operación móvil"}</Text></View>
            <Pressable style={styles.iconButton}><Ionicons name="notifications-outline" size={21} color={colors.ink} /></Pressable>
            <View style={styles.userMini}><View style={styles.userAvatar}><Text style={styles.userInitial}>{user.name[0]}</Text></View>{!compact && <View><Text style={styles.userName}>{user.name}</Text><Text style={styles.userRole}>{user.role === "ADMIN" ? "Administrador" : "Repartidor"}</Text></View>}</View>
          </View>
          <View style={styles.content}>{content}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Sidebar({ user, current, navigation, onNavigate, onLogout, compact }: any) {
  return (
    <View style={[styles.sidebar, compact && styles.sidebarOverlay]}>
      <View style={styles.sidebarLogo}><WaterMark /></View>
      <ScrollView contentContainerStyle={styles.navScroll}>
        {navigation.map((group: any) => (
          <View key={group.section} style={{ gap: 4 }}>
            <Text style={styles.navSection}>{group.section}</Text>
            {group.items.map(([label, glyph]: [string, keyof typeof Ionicons.glyphMap]) => {
              const active = current === label;
              return (
                <Pressable key={label} onPress={() => onNavigate(label)} style={[styles.navItem, active && styles.navItemActive]}>
                  <Ionicons name={glyph} size={19} color={active ? colors.cyan : "#9FB3C8"} />
                  <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <View style={styles.sidebarFooter}>
        <View style={styles.userSide}><View style={styles.userAvatar}><Text style={styles.userInitial}>{user.name[0]}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.userSideName}>{user.name}</Text><Text style={styles.userSideRole}>{user.role}</Text></View></View>
        <Pressable onPress={onLogout} style={styles.logout}><Ionicons name="log-out-outline" size={19} color="#9FB3C8" /><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: colors.navy },
  loginRoot: { flex: 1, backgroundColor: colors.background },
  loginAccent: { position: "absolute", right: -140, top: -230, width: 560, height: 560, borderRadius: 280, backgroundColor: "#DFF4FC" },
  loginWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", padding: 24, gap: 70 },
  brandPanel: { width: 470, maxWidth: "100%", padding: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center" },
  logoLarge: { width: 54, height: 54, borderRadius: 17 },
  logoName: { color: "white", fontSize: 22, lineHeight: 24, fontWeight: "900", letterSpacing: 0.6 },
  logoTag: { color: colors.cyan, fontSize: 8, fontWeight: "800", letterSpacing: 1.1, marginTop: 3 },
  brandHeadline: { color: colors.navy, fontWeight: "900", fontSize: 38, lineHeight: 47, marginTop: 48 },
  brandCopy: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 16, marginBottom: 30, maxWidth: 430 },
  brandFeature: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 13 },
  brandFeatureText: { color: colors.navySoft, fontWeight: "700" },
  loginCard: { width: 430, maxWidth: "100%", backgroundColor: "white", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 34, shadowColor: colors.navy, shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: 15 } },
  welcome: { fontSize: 28, fontWeight: "900", color: colors.ink },
  loginSubtitle: { fontSize: 14, color: colors.muted, marginTop: 5 },
  demoBox: { flexDirection: "row", gap: 8, backgroundColor: colors.softBlue, borderRadius: 10, padding: 12, marginTop: 20 },
  demoText: { flex: 1, color: colors.blue, fontSize: 11, lineHeight: 16 },
  workspace: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0 },
  appRow: { flex: 1, flexDirection: "row" },
  sidebar: { width: 255, backgroundColor: colors.navy, zIndex: 20 },
  sidebarOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 8, height: 0 } },
  sidebarLogo: { height: 76, justifyContent: "center", paddingHorizontal: 21, borderBottomWidth: 1, borderBottomColor: "#243B53" },
  navScroll: { padding: 13, gap: 17 },
  navSection: { color: "#627D98", fontSize: 9, fontWeight: "900", letterSpacing: 1.3, paddingHorizontal: 11, marginBottom: 5, textTransform: "uppercase" },
  navItem: { minHeight: 41, borderRadius: 10, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 11 },
  navItemActive: { backgroundColor: "#1E4B6B" },
  navText: { color: "#BCCCDC", fontSize: 13, fontWeight: "600" },
  navTextActive: { color: "white", fontWeight: "800" },
  sidebarFooter: { padding: 14, borderTopWidth: 1, borderTopColor: "#243B53", gap: 11 },
  userSide: { flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center" },
  userInitial: { color: "white", fontWeight: "900", fontSize: 15 },
  userSideName: { color: "white", fontSize: 12, fontWeight: "800" },
  userSideRole: { color: "#829AB1", fontSize: 10, marginTop: 2 },
  logout: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingVertical: 7 },
  logoutText: { color: "#9FB3C8", fontSize: 12 },
  main: { flex: 1, minWidth: 0 },
  topbar: { height: 76, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 19, gap: 12 },
  iconButton: { width: 41, height: 41, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  breadcrumb: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  breadcrumbMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  userMini: { flexDirection: "row", alignItems: "center", gap: 9 },
  userName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  userRole: { color: colors.muted, fontSize: 10, marginTop: 2 },
  content: { flex: 1 }
});
