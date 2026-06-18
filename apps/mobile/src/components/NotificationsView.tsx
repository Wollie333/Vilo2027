import { Pressable, ScrollView, Text, View } from "react-native";
import { Bell } from "lucide-react-native";

import { EmptyState, Skeleton } from "@/components/ui";
import {
  useMarkNotificationRead,
  useNotifications,
  type AppNotification,
} from "@/lib/queries/notifications";
import { brand } from "@/theme/tokens";

function severityColor(severity: string): string {
  if (severity === "error" || severity === "critical") return "#EF4444";
  if (severity === "warning") return "#F59E0B";
  if (severity === "success") return brand.primary;
  return brand.mute;
}

function ago(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

/** Shared in-app notifications list for both guest and host surfaces. */
export function NotificationsView({ userId }: { userId: string | undefined }) {
  const { data: items, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);

  if (isLoading) {
    return (
      <View className="gap-3 p-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={64} rounded={14} />
        ))}
      </View>
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="All caught up"
        message="You have no notifications right now."
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, gap: 10 }}
    >
      {items.map((n) => (
        <Row
          key={n.id}
          item={n}
          onPress={() => !n.read_at && markRead.mutate(n.id)}
        />
      ))}
    </ScrollView>
  );
}

function Row({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}) {
  const unread = !item.read_at;
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row gap-3 rounded-card border p-3.5 active:bg-brand-light ${
        unread
          ? "border-brand-line bg-brand-light"
          : "border-brand-line bg-white"
      }`}
    >
      <View
        className="mt-1.5 h-2 w-2 rounded-full"
        style={{
          backgroundColor: unread
            ? severityColor(item.severity)
            : "transparent",
        }}
      />
      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 font-display text-[14px] text-brand-ink"
          >
            {item.title}
          </Text>
          <Text className="font-sans text-[11px] text-brand-mute">
            {ago(item.created_at)}
          </Text>
        </View>
        {item.body ? (
          <Text className="mt-0.5 font-sans text-[12.5px] leading-relaxed text-brand-mute">
            {item.body}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
