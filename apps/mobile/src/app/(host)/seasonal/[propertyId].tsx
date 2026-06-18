import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarRange, Plus } from "lucide-react-native";

import {
  EmptyState,
  Icon,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostSeasons, type HostSeason } from "@/lib/queries/host-seasons";
import { formatMoney } from "@/lib/format";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function PropertySeasons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostSeasons(
    host?.id,
    propertyId,
  );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.seasons.title")}
        subtitle={t("host.seasons.subtitle")}
        onBack={() => router.back()}
        bordered
        right={
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(host)/season/[id]",
                params: { id: "new", propertyId },
              })
            }
            accessibilityLabel={t("host.seasons.new")}
            className="h-10 w-10 items-center justify-center rounded-full bg-brand-primary active:opacity-90"
          >
            <Icon icon={Plus} size={20} color={brand.white} />
          </Pressable>
        }
      />
      <ScrollView
        className="flex-1"
        refreshControl={pullRefresh({
          refreshing: isRefetching,
          onRefresh: refetch,
        })}
        contentContainerStyle={{
          padding: 20,
          gap: 12,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={72} rounded={16} />)
        ) : isError ? (
          <EmptyState
            icon={CalendarRange}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title={t("host.seasons.emptyTitle")}
            message={t("host.seasons.emptyMessage")}
          />
        ) : (
          data.map((season) => (
            <SeasonRow
              key={season.id}
              season={season}
              onPress={() =>
                router.push({
                  pathname: "/(host)/season/[id]",
                  params: { id: season.id, propertyId: season.property_id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function fmt(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function adjustmentLabel(s: HostSeason): string {
  return s.adjustment_type === "percent"
    ? `${s.adjustment_value > 0 ? "+" : ""}${s.adjustment_value}%`
    : formatMoney(s.adjustment_value, s.currency);
}

function SeasonRow({
  season,
  onPress,
}: {
  season: HostSeason;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-card border border-brand-line p-3.5 active:bg-brand-light"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 font-display text-[15px] text-brand-ink"
        >
          {season.label}
        </Text>
        <Tag
          label={
            season.is_active
              ? t("host.seasons.active")
              : t("host.seasons.hidden")
          }
          tone={season.is_active ? "green" : "gray"}
        />
      </View>
      <Text className="mt-1 font-sans text-[12.5px] text-brand-mute">
        {fmt(season.start_date)} – {fmt(season.end_date)} ·{" "}
        {adjustmentLabel(season)}
      </Text>
    </Pressable>
  );
}
