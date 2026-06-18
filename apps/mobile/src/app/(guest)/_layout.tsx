import { Tabs } from "expo-router";
import {
  Briefcase,
  House,
  MessageCircle,
  Search,
  User,
} from "lucide-react-native";

import { Icon } from "@/components/ui";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function GuestTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: brand.mute,
        tabBarStyle: { borderTopColor: brand.line, backgroundColor: "#fff" },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 10.5 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("guest.tabs.home"),
          tabBarIcon: ({ color }) => (
            <Icon icon={House} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("guest.tabs.search"),
          tabBarIcon: ({ color }) => (
            <Icon icon={Search} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t("guest.tabs.trips"),
          tabBarIcon: ({ color }) => (
            <Icon icon={Briefcase} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("guest.tabs.inbox"),
          tabBarIcon: ({ color }) => (
            <Icon icon={MessageCircle} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("guest.tabs.more"),
          tabBarIcon: ({ color }) => (
            <Icon icon={User} size={22} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
