import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarDays,
  MapPin,
  MessageCircle,
  Receipt,
  Users,
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
import { useTripDetail } from "@/lib/queries/trips";
import { brand } from "@/theme/tokens";
import { formatDateRange, formatMoney } from "@/lib/format";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trip, isLoading, isError } = useTripDetail(id);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title="Trip" onBack={() => router.back()} bordered />

      {isLoading ? (
        <View className="gap-3 p-5">
          <Skeleton height={22} width="70%" />
          <Skeleton height={120} />
        </View>
      ) : isError || !trip ? (
        <EmptyState
          icon={MapPin}
          title="Trip not found"
          message="This booking may no longer be available."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View>
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 font-display-extrabold text-[20px] leading-tight text-brand-ink">
                {trip.properties?.name ?? "Stay"}
              </Text>
              <Tag label={trip.status} tone={statusTone(trip.status)} />
            </View>
            {trip.properties?.city ? (
              <Text className="mt-1 font-sans text-[13px] text-brand-mute">
                {trip.properties.city}
              </Text>
            ) : null}
          </View>

          <View className="gap-3 rounded-card border border-brand-line p-4">
            <Row
              icon={CalendarDays}
              label="Dates"
              value={formatDateRange(trip.check_in, trip.check_out)}
            />
            <Row
              icon={Users}
              label="Guests"
              value={`${trip.guests_count}${trip.nights ? ` · ${trip.nights} nights` : ""}`}
            />
            <Row icon={Receipt} label="Reference" value={trip.reference} />
            <View className="mt-1 flex-row items-center justify-between border-t border-brand-line pt-3">
              <Text className="font-sans text-[13px] text-brand-mute">
                Total
              </Text>
              <Text className="font-display text-[17px] text-brand-ink">
                {formatMoney(trip.total_amount, trip.currency)}
              </Text>
            </View>
            <Text className="font-sans text-[12px] text-brand-mute">
              Payment: {trip.payment_status}
            </Text>
          </View>

          <Button
            label="Message host"
            variant="secondary"
            icon={MessageCircle}
          />

          {/* Cancel / review / pay balance route through shared Edge Functions (Phase 6). */}
          <Text className="text-center font-sans text-[12px] text-brand-mute">
            Cancelling, paying a balance and leaving a review arrive once the
            shared booking functions land.
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
      <Text className="font-sans-semibold text-[13px] text-brand-ink">
        {value}
      </Text>
    </View>
  );
}
