import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "./theme";

export type MapboxPlace = {
  label: string;
  latitude: number;
  longitude: number;
};

type SearchResult = MapboxPlace & { id: string };
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

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
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(trimmed)}&country=mx&language=es&limit=5&access_token=${accessToken}`,
        { signal: controller.signal }
      )
        .then((response) => response.json())
        .then((body) => {
          const next = (body.features ?? []).flatMap((feature: any) => {
            const coordinates = feature.geometry?.coordinates;
            if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
            const properties = feature.properties ?? {};
            const resultLabel = properties.full_address
              ?? [properties.name, properties.place_formatted].filter(Boolean).join(", ")
              ?? feature.place_name;
            return resultLabel ? [{
              id: feature.id,
              label: resultLabel,
              longitude: coordinates[0],
              latitude: coordinates[1]
            }] : [];
          });
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
  }, [query, value?.label]);

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
              onPress={() => {
                onChange(result);
                setQuery(result.label);
                setResults([]);
              }}
            >
              <Ionicons name="location-outline" size={19} color={colors.blue} />
              <Text style={styles.resultText}>{result.label}</Text>
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
  resultText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18 },
  selectedText: { color: colors.green, fontSize: 11, fontWeight: "700" }
});
