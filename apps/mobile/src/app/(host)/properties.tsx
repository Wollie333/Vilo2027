import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home } from "lucide-react-native";

import {
  EmptyState,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  catalogueCover,
  useHostCatalogue,
  type HostPropertyListItem,
} from "@/lib/queries/host-catalogue";
import { formatMoney } from "@/lib/format";
import { t } from "@/i18n";

export default function HostProperties() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostCatalogue(
    host?.id,
  );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.properties.title")}
        subtitle={t("host.properties.subtitle")}
        onBack={() => router.back()}
        bordered
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
          [0, 1, 2].map((i) => <Skeleton key={i} height={84} rounded={16} />)
        ) : isError ? (
          <EmptyState
            icon={Home}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Home}
            title={t("host.properties.emptyTitle")}
            message={t("host.properties.emptyMessage")}
          />
        ) : (
          data.map((p) => (
            <PropertyRow
              key={p.id}
              property={p}
              onPress={() =>
                router.push({
                  pathname: "/(host)/property/[id]",
                  params: { id: p.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function PropertyRow({
  property,
  onPress,
}: {
  property: HostPropertyListItem;
  onPress: () => void;
}) {
  const cover = catalogueCover(property);
  const place = [property.city, property.province].filter(Boolean).join(", ");
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-card border border-brand-line p-3 active:bg-brand-light"
    >
      <View className="h-16 w-16 overflow-hidden rounded-[12px] bg-brand-light">
        {cover ? (
          <Image
            source={{ uri: cover }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="font-display text-[15px] text-brand-ink"
        >
          {property.name}
        </Text>
        {place ? (
          <Text
            numberOfLines={1}
            className="font-sans text-[12.5px] text-brand-mute"
          >
            {place}
          </Text>
        ) : null}
        <Text className="mt-0.5 font-sans text-[12.5px] text-brand-mute">
          {formatMoney(property.base_price, property.currency)}
        </Text>
      </View>
      <Tag
        label={
          property.is_published
            ? t("host.properties.published")
            : t("host.properties.draft")
        }
        tone={property.is_published ? "green" : "gray"}
      />
    </Pressable>
  );
}
