import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight, House, LogOut } from "lucide-react-native";

import { Avatar, Card, Icon, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAppStore } from "@/stores/app-store";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function GuestMore() {
  const { profile, session, isHost, signOut } = useAuth();
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  const name = profile?.full_name ?? session?.user.email ?? "Guest";

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("guest.tabs.more")} bordered />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        <Card padded>
          <View className="flex-row items-center gap-3">
            <Avatar name={name} uri={profile?.avatar_url} size={52} />
            <View className="flex-1">
              <Text className="font-display text-[16px] text-brand-ink">
                {name}
              </Text>
              {session?.user.email ? (
                <Text className="font-sans text-[13px] text-brand-mute">
                  {session.user.email}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {isHost ? (
          <Pressable onPress={() => setActiveRole("host")}>
            <Card padded className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-light">
                <Icon icon={House} size={20} color={brand.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-display text-[15px] text-brand-ink">
                  Switch to host
                </Text>
                <Text className="font-sans text-[12.5px] text-brand-mute">
                  Manage your establishment
                </Text>
              </View>
              <Icon icon={ChevronRight} size={20} color={brand.mute} />
            </Card>
          </Pressable>
        ) : null}

        <Pressable onPress={signOut}>
          <Card padded className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FEF2F2]">
              <Icon icon={LogOut} size={20} color={brand.mute} />
            </View>
            <Text className="flex-1 font-display text-[15px] text-status-cancelled">
              Sign out
            </Text>
          </Card>
        </Pressable>
      </ScrollView>
    </View>
  );
}
