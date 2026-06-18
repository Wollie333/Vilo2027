import { ActivityIndicator, View } from "react-native";
import { brand } from "@/theme/tokens";

// Entry route. The root navigator redirects to (auth) or (guest)/(host) once the
// session is resolved; this is the brief loading state shown meanwhile.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color={brand.primary} />
    </View>
  );
}
