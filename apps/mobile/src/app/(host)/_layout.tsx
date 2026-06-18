import { Stack } from "expo-router";

// Host surface: the tab bar lives in (tabs); detail screens are pushed over it.
export default function HostLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#fff" },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="guests" />
      <Stack.Screen name="guest/[id]" />
      <Stack.Screen name="properties" />
      <Stack.Screen name="property/[id]" />
      <Stack.Screen name="rooms/[propertyId]" />
      <Stack.Screen name="room/[id]" />
      <Stack.Screen name="reviews" />
      <Stack.Screen name="addons" />
      <Stack.Screen name="addon/[id]" />
      <Stack.Screen name="coupons" />
      <Stack.Screen name="coupon/[id]" />
      <Stack.Screen name="seasonal/[propertyId]" />
      <Stack.Screen name="season/[id]" />
      <Stack.Screen name="policies/[propertyId]" />
      <Stack.Screen name="finance" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
