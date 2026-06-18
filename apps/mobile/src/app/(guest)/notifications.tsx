import { View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenHeader } from "@/components/ui";
import { NotificationsView } from "@/components/NotificationsView";
import { useAuth } from "@/lib/auth/auth-provider";

export default function GuestNotifications() {
  const router = useRouter();
  const { session } = useAuth();
  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        bordered
      />
      <NotificationsView userId={session?.user.id} />
    </View>
  );
}
