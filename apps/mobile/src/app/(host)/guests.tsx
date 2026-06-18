import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Search as SearchIcon, Users } from "lucide-react-native";

import {
  Avatar,
  EmptyState,
  Icon,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useHostGuests, type HostGuest } from "@/lib/queries/guests";
import { brand } from "@/theme/tokens";

export default function HostGuests() {
  const router = useRouter();
  const { host } = useAuth();
  const { data: guests, isLoading } = useHostGuests(host?.id);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const all = guests ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((g) =>
      [g.name, g.email, g.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [guests, q]);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title="Guests" onBack={() => router.back()} bordered />

      <View className="border-b border-brand-line px-5 py-3">
        <View className="flex-row items-center gap-2.5 rounded-pill border border-brand-line bg-white px-4 py-2.5">
          <Icon icon={SearchIcon} size={17} color={brand.primary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search guests…"
            placeholderTextColor="#A6BFB1"
            autoCorrect={false}
            className="min-w-0 flex-1 font-sans text-[14px] text-brand-ink"
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {isLoading ? (
          <View className="gap-3 px-5 pt-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={56} rounded={14} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No guests yet"
            message="Guests you host will appear here."
          />
        ) : (
          filtered.map((g) => (
            <GuestRow
              key={g.id}
              guest={g}
              onPress={() =>
                router.push({
                  pathname: "/(host)/guest/[id]",
                  params: { id: g.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function GuestRow({
  guest,
  onPress,
}: {
  guest: HostGuest;
  onPress?: () => void;
}) {
  const name = guest.name ?? guest.email;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-5 py-3 active:bg-brand-light"
    >
      <Avatar name={name} size={44} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 font-display text-[14px] text-brand-ink"
          >
            {name}
          </Text>
          {guest.blocked ? (
            <Tag label="Blocked" tone="red" dot={false} />
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          className="font-sans text-[12.5px] text-brand-mute"
        >
          {guest.email}
        </Text>
      </View>
    </Pressable>
  );
}
