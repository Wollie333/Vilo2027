import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarCheck } from "lucide-react-native";

import {
  Chip,
  EmptyState,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostBookings, type HostBooking } from "@/lib/queries/host";
import { formatDateRange, formatMoney } from "@/lib/format";
import { t } from "@/i18n";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "checked_in", label: "Checked in" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function HostBookings() {
  const router = useRouter();
  const { host } = useAuth();
  const {
    data: bookings,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useHostBookings(host?.id);
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (bookings ?? []).forEach((b) => (c[b.status] = (c[b.status] ?? 0) + 1));
    return c;
  }, [bookings]);

  const filtered = useMemo(() => {
    const all = bookings ?? [];
    return filter === "all" ? all : all.filter((b) => b.status === filter);
  }, [bookings, filter]);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("host.tabs.bookings")} bordered />

      <View className="border-b border-brand-line">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 12, gap: 8 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              count={f.key === "all" ? bookings?.length : counts[f.key]}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefresh({
          refreshing: isRefetching,
          onRefresh: refetch,
        })}
        contentContainerStyle={{ padding: 20, gap: 12 }}
      >
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={84} rounded={16} />)
        ) : isError ? (
          <EmptyState
            icon={CalendarCheck}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
            action={{ label: t("common.retry"), onPress: () => refetch() }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No bookings"
            message="Bookings in this filter will appear here."
          />
        ) : (
          filtered.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              onPress={() =>
                router.push({
                  pathname: "/(host)/booking/[id]",
                  params: { id: b.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function BookingRow({
  booking,
  onPress,
}: {
  booking: HostBooking;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-card border border-brand-line p-3.5 active:bg-brand-light"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text
          numberOfLines={1}
          className="flex-1 font-display text-[14px] text-brand-ink"
        >
          {booking.guest_name ?? "Guest"}
        </Text>
        <Tag label={booking.status} tone={statusTone(booking.status)} />
      </View>
      <Text
        numberOfLines={1}
        className="mt-0.5 font-sans text-[12.5px] text-brand-mute"
      >
        {booking.properties?.name ?? ""}
      </Text>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="font-sans text-[12.5px] text-brand-mute">
          {formatDateRange(booking.check_in, booking.check_out)}
        </Text>
        <Text className="font-sans-bold text-[13px] text-brand-ink">
          {formatMoney(booking.total_amount, booking.currency)}
        </Text>
      </View>
    </Pressable>
  );
}
