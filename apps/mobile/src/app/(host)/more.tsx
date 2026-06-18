import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronRight, Luggage, LogOut } from "lucide-react-native";

import { Avatar, Card, Icon, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAppStore } from "@/stores/app-store";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function HostMore() {
  const { host, profile, session, signOut } = useAuth();
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  const name =
    host?.display_name ?? profile?.full_name ?? session?.user.email ?? "Host";

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("host.tabs.more")} bordered />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        <Card padded>
          <View className="flex-row items-center gap-3">
            <Avatar
              name={name}
              uri={host?.avatar_url ?? profile?.avatar_url}
              size={52}
            />
            <View className="flex-1">
              <Text className="font-display text-[16px] text-brand-ink">
                {name}
              </Text>
              {host?.handle ? (
                <Text className="font-sans text-[13px] text-brand-mute">
                  @{host.handle}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        <Pressable onPress={() => setActiveRole("guest")}>
          <Card padded className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-light">
              <Icon icon={Luggage} size={20} color={brand.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-display text-[15px] text-brand-ink">
                Switch to guest
              </Text>
              <Text className="font-sans text-[12.5px] text-brand-mute">
                Browse and book stays
              </Text>
            </View>
            <Icon icon={ChevronRight} size={20} color={brand.mute} />
          </Card>
        </Pressable>

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
