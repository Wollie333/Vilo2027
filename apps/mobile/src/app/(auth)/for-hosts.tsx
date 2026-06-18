import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Percent,
  Wallet,
} from "lucide-react-native";

import { Button, Icon, ScreenHeader } from "@/components/ui";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/theme/tokens";

const benefits = [
  {
    icon: Percent,
    title: "Zero commission",
    body: "Keep every rand. A flat monthly fee — never a cut of your bookings.",
  },
  {
    icon: CalendarCheck,
    title: "One tidy dashboard",
    body: "Bookings, calendar, guests, payments and messages in one place.",
  },
  {
    icon: Wallet,
    title: "Direct payouts",
    body: "Guests pay you directly via your own payment account.",
  },
  {
    icon: BadgeCheck,
    title: "Live in minutes",
    body: "List your place and start taking direct bookings the same day.",
  },
];

export default function ForHostsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title="" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-2">
          <Logo size={52} />
          <Text className="mt-5 font-display-extrabold text-[32px] leading-[1.05] text-brand-ink">
            Take your bookings direct.{" "}
            <Text className="text-brand-primary">Keep every rand.</Text>
          </Text>
          <Text className="mt-3 font-sans text-[15px] leading-relaxed text-brand-mute">
            Vilo gives accommodation hosts a complete management platform —
            without the marketplace commission.
          </Text>
        </View>

        <View className="mt-6 gap-3 px-6">
          {benefits.map((b) => (
            <View
              key={b.title}
              className="flex-row gap-3 rounded-card border border-brand-line bg-white p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-light">
                <Icon icon={b.icon} size={20} color={brand.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-display text-[15px] text-brand-ink">
                  {b.title}
                </Text>
                <Text className="mt-0.5 font-sans text-[13px] leading-relaxed text-brand-mute">
                  {b.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-7 px-6">
          <Button
            label="Become a host"
            iconRight={ArrowRight}
            onPress={() => router.push("/(auth)/register")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
