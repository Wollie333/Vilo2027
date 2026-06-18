import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";

import { Button, EmptyState, ScreenHeader } from "@/components/ui";
import { usePropertyDetail } from "@/lib/queries/properties";
import { formatMoney } from "@/lib/format";

// Checkout UI shell. Server-side pricing + booking creation + payment route
// through a shared Edge Function (Phase 6) so web and mobile price identically
// and never trust client-supplied amounts.
export default function CheckoutScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { data: property } = usePropertyDetail(slug);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title="Confirm & pay"
        onBack={() => router.back()}
        bordered
      />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {property ? (
          <View className="rounded-card border border-brand-line p-4">
            <Text className="font-display text-[16px] text-brand-ink">
              {property.name}
            </Text>
            {property.base_price != null ? (
              <Text className="mt-1 font-sans text-[14px] text-brand-ink">
                <Text className="font-sans-bold">
                  {formatMoney(property.base_price, property.currency)}
                </Text>
                <Text className="text-brand-mute"> /night</Text>
              </Text>
            ) : null}
          </View>
        ) : null}

        <EmptyState
          icon={ShieldCheck}
          title="Secure checkout coming next"
          message="Dates, server-priced totals and payment are wired through the shared booking function in Phase 6 — so the price you pay is always recalculated on the server."
        />

        <Button
          label="Back to listing"
          variant="secondary"
          onPress={() => router.back()}
        />
      </ScrollView>
    </View>
  );
}
