import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, CalendarCheck } from "lucide-react-native";

import {
  Avatar,
  EmptyState,
  Icon,
  Skeleton,
  Tag,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  deriveKpis,
  useHostBookings,
  type HostBooking,
} from "@/lib/queries/host";
import { brand } from "@/theme/tokens";
import { formatDateRange, formatMoney } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HostOverview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host, profile, session } = useAuth();
  const { data: bookings, isLoading } = useHostBookings(host?.id);

  const kpis = useMemo(() => deriveKpis(bookings), [bookings]);
  const name = (
    host?.display_name ??
    profile?.full_name ??
    session?.user.email ??
    "there"
  ).split(/[\s@]/)[0];

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Header */}
        <View
          className="border-b border-brand-line bg-white px-5 pb-3.5"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[12px] text-brand-mute">
                {new Date().toLocaleDateString("en-ZA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text className="font-display-extrabold text-[20px] leading-tight text-brand-ink">
                {greeting()}, {name}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => router.push("/(host)/notifications")}
                className="h-10 w-10 items-center justify-center rounded-full border border-brand-line active:bg-brand-light"
              >
                <Icon icon={Bell} size={19} color={brand.ink} />
              </Pressable>
              <Avatar
                name={name}
                uri={host?.avatar_url ?? profile?.avatar_url}
                size={40}
              />
            </View>
          </View>
        </View>

        {/* KPI band */}
        <View className="flex-row flex-wrap gap-2.5 px-5 pt-4">
          {isLoading ? (
            [0, 1].map((i) => (
              <Skeleton key={i} height={80} width="47%" rounded={16} />
            ))
          ) : (
            <>
              <Kpi
                label="Revenue"
                value={formatMoney(kpis.revenue, kpis.currency)}
              />
              <Kpi label="Confirmed" value={String(kpis.confirmedCount)} />
              <Kpi
                label="Pending"
                value={String(kpis.pendingCount)}
                tone="amber"
              />
              <Kpi label="Upcoming" value={String(kpis.upcoming.length)} />
            </>
          )}
        </View>

        {/* Upcoming stays */}
        <View className="px-5 pt-6">
          <Text className="mb-3 font-display text-[16px] text-brand-ink">
            Upcoming stays
          </Text>
          {isLoading ? (
            <View className="gap-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} height={72} rounded={14} />
              ))}
            </View>
          ) : kpis.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No upcoming stays"
              message="Confirmed bookings will appear here."
            />
          ) : (
            <View className="gap-3">
              {kpis.upcoming.slice(0, 8).map((b) => (
                <UpcomingRow
                  key={b.id}
                  booking={b}
                  onPress={() =>
                    router.push({
                      pathname: "/(host)/booking/[id]",
                      params: { id: b.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber";
}) {
  return (
    <View
      className="flex-1 rounded-card border border-brand-line p-3.5"
      style={{ minWidth: "47%" }}
    >
      <Text className="font-sans text-[11px] uppercase tracking-wider text-brand-mute">
        {label}
      </Text>
      <Text
        className={`mt-1 font-display-extrabold text-[20px] ${tone === "amber" ? "text-[#B45309]" : "text-brand-ink"}`}
      >
        {value}
      </Text>
    </View>
  );
}

function UpcomingRow({
  booking,
  onPress,
}: {
  booking: HostBooking;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-card border border-brand-line p-3.5 active:bg-brand-light"
    >
      <View className="min-w-0 flex-1 pr-3">
        <Text
          numberOfLines={1}
          className="font-display text-[14px] text-brand-ink"
        >
          {booking.guest_name ?? "Guest"}
        </Text>
        <Text
          numberOfLines={1}
          className="font-sans text-[12px] text-brand-mute"
        >
          {booking.properties?.name ?? ""} ·{" "}
          {formatDateRange(booking.check_in, booking.check_out)}
        </Text>
      </View>
      <Tag label={booking.status} tone={statusTone(booking.status)} />
    </Pressable>
  );
}
