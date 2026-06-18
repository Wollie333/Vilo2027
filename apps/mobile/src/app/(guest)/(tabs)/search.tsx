import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Search as SearchIcon, SearchX } from "lucide-react-native";

import { EmptyState, Icon, pullRefresh, Skeleton } from "@/components/ui";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useDirectoryProperties } from "@/lib/queries/properties";
import { brand } from "@/theme/tokens";

export default function GuestSearch() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    data: properties,
    isLoading,
    refetch,
    isRefetching,
  } = useDirectoryProperties();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const all = properties ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((p) =>
      [p.name, p.city, p.province, p.property_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [properties, q]);

  return (
    <View className="flex-1 bg-white">
      {/* Search header */}
      <View
        className="border-b border-brand-line bg-white px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-full border border-brand-line">
            <Icon icon={ArrowLeft} size={20} color={brand.ink} />
          </View>
          <View className="min-w-0 flex-1 flex-row items-center gap-2.5 rounded-pill border border-brand-line bg-white px-4 py-2.5">
            <Icon icon={SearchIcon} size={17} color={brand.primary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search stays, towns…"
              placeholderTextColor="#A6BFB1"
              autoCorrect={false}
              className="min-w-0 flex-1 font-sans text-[14px] text-brand-ink"
            />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefresh({
          refreshing: isRefetching,
          onRefresh: refetch,
        })}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between px-5 pb-1 pt-3.5">
          <Text className="font-sans text-[13px] text-brand-ink">
            <Text className="font-sans-bold">{results.length}</Text> stays
            {q ? <Text className="text-brand-mute"> · “{q}”</Text> : null}
          </Text>
        </View>

        <View className="gap-5 px-5 pt-2">
          {isLoading ? (
            [0, 1, 2].map((i) => (
              <View key={i}>
                <Skeleton height={200} rounded={16} />
                <Skeleton height={14} width="60%" className="mt-3" />
              </View>
            ))
          ) : results.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matches"
              message={
                q
                  ? "Try a different town or stay name."
                  : "No published stays yet."
              }
            />
          ) : (
            results.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                onPress={() =>
                  p.slug && router.push(`/(guest)/property/${p.slug}`)
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
