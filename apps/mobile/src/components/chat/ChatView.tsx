import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";

import { Icon } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useMessages,
  useMessagesRealtime,
  useSendMessage,
  type Message,
} from "@/lib/queries/inbox";
import { brand } from "@/theme/tokens";

// Shared two-pane chat used by both the guest and host surfaces. The only
// difference is which read flag a sent message sets (role).
export function ChatView({
  conversationId,
  role,
  title = "Chat",
}: {
  conversationId: string;
  role: "guest" | "host";
  title?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: messages } = useMessages(conversationId);
  const send = useSendMessage(conversationId, role);
  useMessagesRealtime(conversationId);

  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const tmo = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(tmo);
  }, [messages?.length]);

  function onSend() {
    const body = text.trim();
    if (!body || !session) return;
    setText("");
    send.mutate({ body, senderId: session.user.id });
  }

  const myId = session?.user.id;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-[#E7F0EA]">
        <View
          className="flex-row items-center gap-2 border-b border-brand-line bg-white px-4 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-brand-light"
          >
            <Icon icon={ArrowLeft} size={20} color={brand.ink} />
          </Pressable>
          <Text className="font-display text-[16px] text-brand-ink">
            {title}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, gap: 8 }}
        >
          {(messages ?? []).map((m) => (
            <Bubble
              key={m.id}
              message={m}
              mine={!!myId && m.sender_id === myId}
            />
          ))}
        </ScrollView>

        <View
          className="flex-row items-end gap-2 border-t border-brand-line bg-white px-3 pt-2"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor="#A6BFB1"
            multiline
            className="max-h-28 min-h-[42px] flex-1 rounded-[20px] border border-brand-line bg-white px-4 py-2.5 font-sans text-[14px] text-brand-ink"
          />
          <Pressable
            onPress={onSend}
            disabled={!text.trim() || send.isPending}
            className={`h-[42px] w-[42px] items-center justify-center rounded-full ${
              text.trim() ? "bg-brand-primary" : "bg-brand-line"
            }`}
          >
            <Icon icon={Send} size={18} color={brand.white} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  if (message.is_system_message) {
    return (
      <View className="items-center py-1">
        <Text className="rounded-pill bg-[#DCEAE0] px-3 py-1 font-sans text-[11px] text-brand-mute">
          {message.body}
        </Text>
      </View>
    );
  }
  return (
    <View
      className={`max-w-[82%] rounded-[13px] px-3 py-2 ${
        mine ? "self-end bg-brand-accent" : "self-start bg-white"
      }`}
    >
      <Text className="font-sans text-[13.5px] leading-[19px] text-brand-ink">
        {message.body}
      </Text>
    </View>
  );
}
