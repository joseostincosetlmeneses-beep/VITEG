import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "./theme";

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled = false
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        (pressed || disabled) && { opacity: 0.7 }
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={variant === "secondary" ? colors.blue : "white"} />}
      <Text style={[styles.buttonText, variant === "secondary" && { color: colors.blue }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9FB3C8" style={styles.input} {...props} />
    </View>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

export function StatusPill({ value }: { value: string }) {
  const good = ["ACTIVE", "COMPLETED", "DELIVERED", "APPROVED"].includes(value);
  const warning = ["PENDING", "SCHEDULED", "PAUSED", "PARTIAL", "PARTIALLY_DELIVERED"].includes(value);
  const backgroundColor = good ? colors.softGreen : warning ? colors.softAmber : value === "IN_PROGRESS" || value === "ASSIGNED" ? colors.softBlue : colors.softRed;
  const color = good ? colors.green : warning ? "#B76E00" : value === "IN_PROGRESS" || value === "ASSIGNED" ? colors.blue : colors.red;
  return <Text style={[styles.pill, { backgroundColor, color }]}>{value.replaceAll("_", " ")}</Text>;
}

export function Loading() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.sky} /></View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    shadowColor: colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  buttonSecondary: { backgroundColor: colors.softBlue, borderWidth: 1, borderColor: "#BFDBFE" },
  buttonDanger: { backgroundColor: colors.red },
  buttonText: { color: "white", fontSize: 15, fontWeight: "700" },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, color: colors.ink, backgroundColor: "white" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  title: { color: colors.ink, fontSize: 24, lineHeight: 31, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  loading: { minHeight: 240, alignItems: "center", justifyContent: "center" }
});
