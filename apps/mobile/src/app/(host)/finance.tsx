import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wallet } from "lucide-react-native";

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
import {
  isInboundKind,
  summariseCash,
  useHostPayments,
  type HostPayment,
} from "@/lib/queries/host-finance";
import { formatMoney } from "@/lib/format";
import { t } from "@/i18n";

const CONFIRMED = new Set(["confirmed", "checked_in", "completed"]);

export default function HostFinance() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host } = useAuth();
  const payments = useHostPayments(host?.id);
  const bookings = useHostBookings(host?.id);

  const cash = useMemo(() => summariseCash(payments.data), [payments.data]);

  // Outstanding = unpaid balance across active bookings (total − collected).
  const outstanding = useMemo(() => {
    const list = bookings.data ?? [];
    return list
      .filter((b) => CONFIRMED.has(b.status))
      .reduce((sum, b) => {
        const paid = cash.collectedByBooking[b.id] ?? 0;
        return sum + Math.max(0, (b.total_amount ?? 0) - paid);
      }, 0);
  }, [bookings.data, cash.collectedByBooking]);

  const loading = payments.isLoading || bookings.isLoading;
  const error = payments.isError || bookings.isError;
  const ccy = cash.currency;

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.finance.title")}
        subtitle={t("host.finance.subtitle")}
        onBack={() => router.back()}
        bordered
      />
      <ScrollView
        className="flex-1"
        refreshControl={pullRefresh({
          refreshing: payments.isRefetching || bookings.isRefetching,
          onRefresh: () => {
            payments.refetch();
            bookings.refetch();
          },
        })}
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {loading ? (
          <>
            <Skeleton height={120} rounded={16} />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} rounded={14} />
            ))}
          </>
        ) : error ? (
          <EmptyState
            icon={Wallet}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : (
          <>
            {/* Cash position */}
            <View className="rounded-card border border-brand-line p-4">
              <Text className="font-sans text-[11px] uppercase tracking-wider text-brand-mute">
                {t("host.finance.netCash")}
              </Text>
              <Text className="mt-1 font-display-extrabold text-[28px] text-brand-ink">
                {formatMoney(cash.net, ccy)}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Stat
                  label={t("host.finance.collected")}
                  value={formatMoney(cash.collected, ccy)}
                />
                <Stat
                  label={t("host.finance.refunded")}
                  value={formatMoney(cash.refunded, ccy)}
                />
                <Stat
                  label={t("host.finance.outstanding")}
                  value={formatMoney(outstanding, ccy)}
                  tone="amber"
                />
              </View>
            </View>

            {/* Transactions */}
            <Text className="mt-2 font-display text-[16px] text-brand-ink">
              {t("host.finance.transactions")}
            </Text>
            {(payments.data ?? []).length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={t("host.finance.emptyTitle")}
                message={t("host.finance.emptyMessage")}
              />
            ) : (
              <View className="gap-2.5">
                {(payments.data ?? []).map((p) => (
                  <PaymentRow key={p.id} payment={p} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({
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
      className="flex-1 rounded-[12px] bg-brand-light/60 p-2.5"
      style={{ minWidth: "30%" }}
    >
      <Text className="font-sans text-[10.5px] uppercase tracking-wide text-brand-mute">
        {label}
      </Text>
      <Text
        className={`mt-0.5 font-display text-[14px] ${tone === "amber" ? "text-[#B45309]" : "text-brand-ink"}`}
      >
        {value}
      </Text>
    </View>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function PaymentRow({ payment }: { payment: HostPayment }) {
  const inbound = isInboundKind(payment.kind);
  const sign = inbound ? "" : "−";
  const who =
    payment.bookings?.guest_name ??
    payment.bookings?.properties?.name ??
    payment.bookings?.reference ??
    "—";
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-card border border-brand-line p-3.5">
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="font-display text-[14px] text-brand-ink"
        >
          {t(`host.finance.kind_${payment.kind}`)} · {who}
        </Text>
        <Text className="mt-0.5 font-sans text-[12px] text-brand-mute">
          {fmtDate(payment.created_at)} · {payment.method}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text
          className={`font-display text-[14px] ${inbound ? "text-brand-ink" : "text-status-cancelled"}`}
        >
          {sign}
          {formatMoney(payment.amount, payment.currency)}
        </Text>
        <Tag
          label={payment.status}
          tone={statusTone(payment.status)}
          dot={false}
        />
      </View>
    </View>
  );
}
