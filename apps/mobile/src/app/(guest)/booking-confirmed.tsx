import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck } from "lucide-react-native";

import { Button, Icon } from "@/components/ui";
import { brand } from "@/theme/tokens";

export default function BookingConfirmedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-white px-8"
      style={{ paddingTop: insets.top }}
    >
      <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-light">
        <Icon icon={CircleCheck} size={40} color={brand.primary} />
      </View>
      <Text className="mt-5 font-display-extrabold text-[24px] text-brand-ink">
        You&apos;re booked!
      </Text>
      <Text className="mt-2 text-center font-sans text-[14px] leading-relaxed text-brand-mute">
        Your trip is confirmed. You&apos;ll find it under My Trips.
      </Text>
      <View className="mt-8 w-full">
        <Button
          label="View my trips"
          onPress={() => router.replace("/(guest)/(tabs)/trips")}
        />
      </View>
    </View>
  );
}
