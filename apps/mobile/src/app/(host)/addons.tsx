import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Tags } from "lucide-react-native";

import {
  EmptyState,
  Icon,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostAddons, type HostAddon } from "@/lib/queries/host-addons";
import { formatMoney } from "@/lib/format";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function HostAddons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostAddons(
    host?.id,
  );

  function openNew() {
    router.push({ pathname: "/(host)/addon/[id]", params: { id: "new" } });
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.addons.title")}
        subtitle={t("host.addons.subtitle")}
        onBack={() => router.back()}
        bordered
        right={
          <Pressable
            onPress={openNew}
            accessibilityLabel={t("host.addons.new")}
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
            icon={Tags}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={t("host.addons.emptyTitle")}
            message={t("host.addons.emptyMessage")}
          />
        ) : (
          data.map((addon) => (
            <AddonRow
              key={addon.id}
              addon={addon}
              onPress={() =>
                router.push({
                  pathname: "/(host)/addon/[id]",
                  params: { id: addon.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function AddonRow({
  addon,
  onPress,
}: {
  addon: HostAddon;
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
          {addon.name}
        </Text>
        <Tag
          label={
            addon.is_active ? t("host.addons.active") : t("host.addons.hidden")
          }
          tone={addon.is_active ? "green" : "gray"}
        />
      </View>
      <Text className="mt-1 font-sans text-[12.5px] text-brand-mute">
        {formatMoney(addon.unit_price, addon.currency)} ·{" "}
        {t(`host.addons.pm_${addon.pricing_model}`)}
      </Text>
    </Pressable>
  );
}
