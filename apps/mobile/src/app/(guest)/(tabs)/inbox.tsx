import { ScrollView, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";

import {
  Avatar,
  EmptyState,
  pullRefresh,
  ScreenHeader,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConversations, type Conversation } from "@/lib/queries/inbox";
import { t } from "@/i18n";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function GuestInbox() {
  const router = useRouter();
  const { session } = useAuth();
  const {
    data: conversations,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useConversations(session?.user.id);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("guest.tabs.inbox")} bordered />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefresh({
          refreshing: isRefetching,
          onRefresh: refetch,
        })}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {isLoading ? (
          <View className="gap-3 px-5 pt-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} rounded={14} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            icon={MessageCircle}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
            action={{ label: t("common.retry"), onPress: () => refetch() }}
          />
        ) : !conversations || conversations.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No messages yet"
            message="When you message a host, the conversation shows up here."
          />
        ) : (
          conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              onPress={() =>
                router.push({
                  pathname: "/(guest)/chat/[id]",
                  params: { id: c.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress?: () => void;
}) {
  const name = conversation.hosts?.display_name ?? "Host";
  const unread = conversation.unread_guest > 0;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-5 py-3 active:bg-brand-light"
    >
      <Avatar name={name} uri={conversation.hosts?.avatar_url} size={48} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            numberOfLines={1}
            className="flex-1 font-display text-[14px] text-brand-ink"
          >
            {name}
          </Text>
          <Text className="font-sans text-[11px] text-brand-mute">
            {timeAgo(conversation.last_message_at)}
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={`flex-1 font-sans text-[12.5px] ${unread ? "text-brand-ink" : "text-brand-mute"}`}
          >
            {conversation.last_message_preview ??
              conversation.properties?.name ??
              "New conversation"}
          </Text>
          {unread ? (
            <View className="min-w-[18px] items-center justify-center rounded-pill bg-brand-primary px-1.5">
              <Text className="font-sans-bold text-[10.5px] text-white">
                {conversation.unread_guest}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
