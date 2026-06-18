import { Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarDays,
  Check,
  Mail,
  Receipt,
  Users,
  X,
} from "lucide-react-native";

import {
  Button,
  EmptyState,
  Icon,
  ScreenHeader,
  Skeleton,
  Tag,
  statusTone,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostBooking } from "@/lib/queries/host";
import { useSetBookingStatus } from "@/lib/queries/host-booking-actions";
import { brand } from "@/theme/tokens";
import { formatDateRange, formatMoney } from "@/lib/format";

export default function HostBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { host } = useAuth();
  const { data: booking, isLoading, isError } = useHostBooking(id);
  const setStatus = useSetBookingStatus(host?.id, id ?? "");

  function onAccept() {
    setStatus.mutate("confirmed", {
      onError: () =>
        Alert.alert("Couldn't accept", "Please refresh and try again."),
    });
  }

  function onDecline() {
    Alert.alert("Decline this booking?", "The guest will be notified.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () =>
          setStatus.mutate("declined", {
            onError: () =>
              Alert.alert("Couldn't decline", "Please refresh and try again."),
          }),
      },
    ]);
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title="Booking" onBack={() => router.back()} bordered />

      {isLoading ? (
        <View className="gap-3 p-5">
          <Skeleton height={22} width="60%" />
          <Skeleton height={140} />
        </View>
      ) : isError || !booking ? (
        <EmptyState
          icon={Receipt}
          title="Booking not found"
          message="It may have been removed."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="font-display-extrabold text-[20px] leading-tight text-brand-ink">
                {booking.guest_name ?? "Guest"}
              </Text>
              <Text className="mt-0.5 font-sans text-[13px] text-brand-mute">
                {booking.properties?.name ?? ""}
              </Text>
            </View>
            <Tag label={booking.status} tone={statusTone(booking.status)} />
          </View>

          <View className="gap-3 rounded-card border border-brand-line p-4">
            <Row
              icon={CalendarDays}
              label="Dates"
              value={formatDateRange(booking.check_in, booking.check_out)}
            />
            <Row
              icon={Users}
              label="Guests"
              value={`${booking.guests_count}${booking.nights ? ` · ${booking.nights} nights` : ""}`}
            />
            {booking.guest_email ? (
              <Row icon={Mail} label="Email" value={booking.guest_email} />
            ) : null}
            <Row icon={Receipt} label="Reference" value={booking.reference} />
            <View className="mt-1 flex-row items-center justify-between border-t border-brand-line pt-3">
              <Text className="font-sans text-[13px] text-brand-mute">
                Total
              </Text>
              <Text className="font-display text-[17px] text-brand-ink">
                {formatMoney(booking.total_amount, booking.currency)}
              </Text>
            </View>
            <Text className="font-sans text-[12px] text-brand-mute">
              Payment: {booking.payment_status}
            </Text>
          </View>

          {/* Accept / decline — only while pending. Drives the same DB triggers
              the web uses (calendar block on confirm, block release on decline). */}
          {booking.status === "pending" ? (
            <View className="gap-2.5">
              <Button
                label="Accept booking"
                icon={Check}
                onPress={onAccept}
                loading={setStatus.isPending}
              />
              <Button
                label="Decline"
                variant="secondary"
                icon={X}
                onPress={onDecline}
                disabled={setStatus.isPending}
              />
            </View>
          ) : null}

          <Button label="Message guest" variant="secondary" />

          {/* Cancel / reschedule / take payment run through shared Edge Functions (later Phase 6 chunks). */}
          <Text className="text-center font-sans text-[12px] text-brand-mute">
            Rescheduling and taking payment arrive with the shared booking
            functions.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Icon icon={icon} size={16} color={brand.mute} />
        <Text className="font-sans text-[13px] text-brand-mute">{label}</Text>
      </View>
      <Text
        className="font-sans-semibold text-[13px] text-brand-ink"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
