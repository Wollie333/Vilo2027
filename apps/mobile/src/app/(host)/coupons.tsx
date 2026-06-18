import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Ticket } from "lucide-react-native";

import {
  EmptyState,
  Icon,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostCoupons, type HostCoupon } from "@/lib/queries/host-coupons";
import { formatMoney } from "@/lib/format";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function HostCoupons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostCoupons(
    host?.id,
  );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.coupons.title")}
        subtitle={t("host.coupons.subtitle")}
        onBack={() => router.back()}
        bordered
        right={
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(host)/coupon/[id]",
                params: { id: "new" },
              })
            }
            accessibilityLabel={t("host.coupons.new")}
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
            icon={Ticket}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={t("host.coupons.emptyTitle")}
            message={t("host.coupons.emptyMessage")}
          />
        ) : (
          data.map((coupon) => (
            <CouponRow
              key={coupon.id}
              coupon={coupon}
              onPress={() =>
                router.push({
                  pathname: "/(host)/coupon/[id]",
                  params: { id: coupon.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function discountLabel(c: HostCoupon): string {
  return c.discount_type === "percent"
    ? `${c.discount_value}% off`
    : `${formatMoney(c.discount_value, c.currency)} off`;
}

function CouponRow({
  coupon,
  onPress,
}: {
  coupon: HostCoupon;
  onPress: () => void;
}) {
  const redemptions =
    coupon.max_redemptions != null
      ? `${coupon.redeemed_count}/${coupon.max_redemptions}`
      : `${coupon.redeemed_count}`;
  return (
    <Pressable
      onPress={onPress}
      className="rounded-card border border-brand-line p-3.5 active:bg-brand-light"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 font-mono text-[15px] font-semibold text-brand-ink"
        >
          {coupon.code}
        </Text>
        <Tag
          label={
            coupon.is_active
              ? t("host.coupons.active")
              : t("host.coupons.hidden")
          }
          tone={coupon.is_active ? "green" : "gray"}
        />
      </View>
      <Text className="mt-1 font-sans text-[12.5px] text-brand-mute">
        {discountLabel(coupon)} · {t("host.coupons.used", { n: redemptions })}
      </Text>
    </Pressable>
  );
}
