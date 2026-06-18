import { Tabs } from "expo-router";
import {
  Calendar,
  CalendarCheck,
  LayoutDashboard,
  MessageCircle,
  Menu,
} from "lucide-react-native";

import { Icon } from "@/components/ui";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function HostTabsLayout() {
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
        name="overview"
        options={{
          title: t("host.tabs.overview"),
          tabBarIcon: ({ color }) => (
            <Icon icon={LayoutDashboard} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t("host.tabs.bookings"),
          tabBarIcon: ({ color }) => (
            <Icon icon={CalendarCheck} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t("host.tabs.calendar"),
          tabBarIcon: ({ color }) => (
            <Icon icon={Calendar} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("host.tabs.inbox"),
          tabBarIcon: ({ color }) => (
            <Icon icon={MessageCircle} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("host.tabs.more"),
          tabBarIcon: ({ color }) => (
            <Icon icon={Menu} size={22} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
