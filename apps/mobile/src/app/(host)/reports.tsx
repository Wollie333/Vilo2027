import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3 } from "lucide-react-native";

import {
  EmptyState,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostBookings } from "@/lib/queries/host";
import { deriveReports, type MonthBucket } from "@/lib/queries/host-reports";
import { formatMoney } from "@/lib/format";
import { t } from "@/i18n";

export default function HostReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostBookings(
    host?.id,
  );

  const reports = useMemo(() => deriveReports(data, new Date()), [data]);
  const ccy = reports.currency;
  const delta = reports.thisMonthRevenue - reports.lastMonthRevenue;

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.reports.title")}
        subtitle={t("host.reports.subtitle")}
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
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {isLoading ? (
          <>
            <Skeleton height={96} rounded={16} />
            <Skeleton height={180} rounded={16} />
          </>
        ) : isError ? (
          <EmptyState
            icon={BarChart3}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={t("host.reports.emptyTitle")}
            message={t("host.reports.emptyMessage")}
          />
        ) : (
          <>
            {/* Headline */}
            <View className="rounded-card border border-brand-line p-4">
              <Text className="font-sans text-[11px] uppercase tracking-wider text-brand-mute">
                {t("host.reports.revenue")}
              </Text>
              <Text className="mt-1 font-display-extrabold text-[26px] text-brand-ink">
                {formatMoney(reports.revenue, ccy)}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Metric
                  label={t("host.reports.thisMonth")}
                  value={formatMoney(reports.thisMonthRevenue, ccy)}
                />
                <Metric
                  label={t("host.reports.vsLastMonth")}
                  value={`${delta >= 0 ? "+" : "−"}${formatMoney(Math.abs(delta), ccy)}`}
                  tone={delta >= 0 ? "good" : "bad"}
                />
                <Metric
                  label={t("host.reports.nights")}
                  value={String(reports.nightsBooked)}
                />
              </View>
            </View>

            {/* Revenue by month */}
            <View className="rounded-card border border-brand-line p-4">
              <Text className="mb-3 font-display text-[15px] text-brand-ink">
                {t("host.reports.byMonth")}
              </Text>
              <MonthlyBars data={reports.monthly} currency={ccy} />
            </View>

            {/* Bookings by status */}
            <View className="rounded-card border border-brand-line p-4">
              <Text className="mb-3 font-display text-[15px] text-brand-ink">
                {t("host.reports.byStatus")}
              </Text>
              <View className="gap-2">
                {reports.byStatus.map((s) => (
                  <View
                    key={s.status}
                    className="flex-row items-center justify-between"
                  >
                    <Tag label={s.status} tone={statusTone(s.status)} />
                    <Text className="font-display text-[15px] text-brand-ink">
                      {s.count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-status-cancelled"
        : "text-brand-ink";
  return (
    <View
      className="flex-1 rounded-[12px] bg-brand-light/60 p-2.5"
      style={{ minWidth: "30%" }}
    >
      <Text className="font-sans text-[10.5px] uppercase tracking-wide text-brand-mute">
        {label}
      </Text>
      <Text className={`mt-0.5 font-display text-[14px] ${color}`}>
        {value}
      </Text>
    </View>
  );
}

function MonthlyBars({
  data,
  currency,
}: {
  data: MonthBucket[];
  currency: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <View
      className="flex-row items-end justify-between gap-2"
      style={{ height: 140 }}
    >
      {data.map((m) => {
        const pct = m.revenue / max;
        return (
          <View key={m.key} className="flex-1 items-center justify-end gap-1.5">
            <Text
              className="font-sans text-[9.5px] text-brand-mute"
              numberOfLines={1}
            >
              {m.revenue > 0 ? formatMoney(m.revenue, currency) : ""}
            </Text>
            <View
              className="w-full rounded-t-[6px] bg-brand-primary"
              style={{ height: Math.max(3, pct * 96) }}
            />
            <Text className="font-sans text-[11px] text-brand-mute">
              {m.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
