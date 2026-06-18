import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BedDouble } from "lucide-react-native";

import {
  EmptyState,
  pullRefresh,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostRooms, type HostRoom } from "@/lib/queries/host-catalogue";
import { formatMoney } from "@/lib/format";
import { t } from "@/i18n";

export default function PropertyRooms() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostRooms(
    host?.id,
    propertyId,
  );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.rooms.title")}
        subtitle={t("host.rooms.subtitle")}
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
          [0, 1, 2].map((i) => <Skeleton key={i} height={72} rounded={16} />)
        ) : isError ? (
          <EmptyState
            icon={BedDouble}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title={t("host.rooms.emptyTitle")}
            message={t("host.rooms.emptyMessage")}
          />
        ) : (
          data.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              onPress={() =>
                router.push({
                  pathname: "/(host)/room/[id]",
                  params: { id: room.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function RoomRow({ room, onPress }: { room: HostRoom; onPress: () => void }) {
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
          {room.name}
        </Text>
        <Tag
          label={
            room.is_active ? t("host.rooms.active") : t("host.rooms.hidden")
          }
          tone={room.is_active ? "green" : "gray"}
        />
      </View>
      <Text className="mt-1 font-sans text-[12.5px] text-brand-mute">
        {formatMoney(room.base_price, room.currency)} ·{" "}
        {t("host.rooms.sleeps", { n: room.max_guests })} ·{" "}
        {t("host.rooms.units", { n: room.inventory_count })}
      </Text>
    </Pressable>
  );
}
