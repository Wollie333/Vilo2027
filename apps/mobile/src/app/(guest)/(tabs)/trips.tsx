import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Briefcase, MapPin } from "lucide-react-native";

import {
  EmptyState,
  Icon,
  pullRefresh,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  Tag,
  statusTone,
  type Segment,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { isPastTrip, useTrips, type Trip } from "@/lib/queries/trips";
import { brand } from "@/theme/tokens";
import { formatDateRange, formatMoney } from "@/lib/format";
import { t } from "@/i18n";

type Tab = "upcoming" | "past";
const tabs: Segment<Tab>[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

export default function GuestTrips() {
  const router = useRouter();
  const { session } = useAuth();
  const {
    data: trips,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useTrips(session?.user.id);
  const [tab, setTab] = useState<Tab>("upcoming");

  const filtered = useMemo(() => {
    const all = trips ?? [];
    return all.filter((trip) =>
      tab === "past" ? isPastTrip(trip) : !isPastTrip(trip),
    );
  }, [trips, tab]);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("guest.tabs.trips")} bordered />
      <View className="px-5 pt-3">
        <SegmentedControl segments={tabs} value={tab} onChange={setTab} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefresh({
          refreshing: isRefetching,
          onRefresh: refetch,
        })}
        contentContainerStyle={{ padding: 20, gap: 14 }}
      >
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={96} rounded={16} />)
        ) : isError ? (
          <EmptyState
            icon={Briefcase}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
            action={{ label: t("common.retry"), onPress: () => refetch() }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={tab === "upcoming" ? "No upcoming trips" : "No past trips"}
            message={
              tab === "upcoming"
                ? "Your next stay will show up here."
                : "Completed stays appear here."
            }
          />
        ) : (
          filtered.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onPress={() =>
                router.push({
                  pathname: "/(guest)/trip/[id]",
                  params: { id: trip.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function tripPhoto(trip: Trip): string | null {
  const photos = [...(trip.properties?.property_photos ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return (photos.find((p) => p.room_id === null) ?? photos[0])?.url ?? null;
}

function TripCard({ trip, onPress }: { trip: Trip; onPress?: () => void }) {
  const photo = tripPhoto(trip);
  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-card border border-brand-line bg-white p-3 active:bg-brand-light"
    >
      <View className="h-[72px] w-[72px] overflow-hidden rounded-[12px] bg-brand-light">
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ flex: 1 }}
            contentFit="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon icon={MapPin} size={20} color={brand.mute} />
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 font-display text-[14px] text-brand-ink"
          >
            {trip.properties?.name ?? "Stay"}
          </Text>
          <Tag label={trip.status} tone={statusTone(trip.status)} />
        </View>
        <Text className="mt-0.5 font-sans text-[12px] text-brand-mute">
          {formatDateRange(trip.check_in, trip.check_out)}
        </Text>
        <Text className="mt-1 font-sans text-[12.5px] text-brand-ink">
          <Text className="font-sans-bold">
            {formatMoney(trip.total_amount, trip.currency)}
          </Text>
          <Text className="text-brand-mute"> · {trip.reference}</Text>
        </Text>
      </View>
    </Pressable>
  );
}
