import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "./theme";

export type MapboxPlace = {
  label: string;
  latitude: number;
  longitude: number;
  customerId?: string;
  addressId?: string;
  items?: Array<{ productId: string; expectedQuantity: number }>;
  priority?: number;
};

type SearchResult = {
  id: string;
  mapboxId: string;
  name: string;
  description: string;
  featureType?: string;
};
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

function createSessionToken() {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function MapboxPlaceSearch({
  label,
  value,
  onChange
}: {
  label: string;
  value: MapboxPlace | null;
  onChange: (place: MapboxPlace | null) => void;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [retrievingId, setRetrievingId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState(createSessionToken);

  useEffect(() => {
    setQuery(value?.label ?? "");
    setResults([]);
  }, [value?.label]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!accessToken || trimmed.length < 3 || trimmed === value?.label) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSearching(true);
      void fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(trimmed)}&country=MX&language=es&limit=8&proximity=-97.9248,19.3139&session_token=${encodeURIComponent(sessionToken)}&access_token=${accessToken}`,
        { signal: controller.signal }
      )
        .then((response) => response.json())
        .then((body) => {
          const next = (body.suggestions ?? []).map((suggestion: any) => ({
            id: `${suggestion.mapbox_id}-${suggestion.name}`,
            mapboxId: suggestion.mapbox_id,
            name: suggestion.name,
            description: suggestion.full_address
              ?? suggestion.place_formatted
              ?? suggestion.address
              ?? "México",
            featureType: suggestion.feature_type
          }));
          setResults(next);
        })
        .catch((error) => {
          if (error?.name !== "AbortError") setResults([]);
        })
        .finally(() => setSearching(false));
    }, 450);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, sessionToken, value?.label]);

  const selectResult = async (result: SearchResult) => {
    if (!accessToken) return;
    setRetrievingId(result.id);
    try {
      const response = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(result.mapboxId)}?language=es&session_token=${encodeURIComponent(sessionToken)}&access_token=${accessToken}`
      );
      const body = await response.json();
      const feature = body.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        throw new Error("Mapbox no devolvió coordenadas para este lugar");
      }
      const properties = feature.properties ?? {};
      const nextValue = {
        label: properties.full_address
          ?? [properties.name ?? result.name, properties.place_formatted ?? result.description].filter(Boolean).join(", "),
        longitude: coordinates[0],
        latitude: coordinates[1]
      };
      onChange(nextValue);
      setQuery(nextValue.label);
      setResults([]);
      setSessionToken(createSessionToken());
    } catch (error) {
      Alert.alert("No se pudo seleccionar", error instanceof Error ? error.message : "Mapbox no devolvió la ubicación");
    } finally {
      setRetrievingId(null);
    }
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, value && styles.inputSelected]}>
        <Ionicons name={value ? "location" : "search"} size={20} color={value ? colors.green : colors.blue} />
        <TextInput
          value={query}
          onChangeText={(next) => {
            setQuery(next);
            if (value && next !== value.label) onChange(null);
          }}
          placeholder="Busca calle, colonia o lugar"
          placeholderTextColor="#9FB3C8"
          style={styles.input}
          autoCapitalize="words"
        />
        {searching && <ActivityIndicator size="small" color={colors.blue} />}
      </View>
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((result) => (
            <Pressable
              key={result.id}
              style={styles.result}
              disabled={Boolean(retrievingId)}
              onPress={() => void selectResult(result)}
            >
              {retrievingId === result.id
                ? <ActivityIndicator size="small" color={colors.blue} />
                : <Ionicons name={result.featureType === "poi" ? "business-outline" : "location-outline"} size={19} color={colors.blue} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultText}>{result.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {value && (
        <Text style={styles.selectedText}>Ubicación seleccionada · {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  inputWrap: {
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: "white"
  },
  inputSelected: { borderColor: colors.green },
  input: { flex: 1, minHeight: 48, color: colors.ink },
  results: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: "hidden", backgroundColor: "white" },
  result: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  resultName: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  resultText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  selectedText: { color: colors.green, fontSize: 11, fontWeight: "700" }
});
