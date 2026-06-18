import { Stack } from "expo-router";

// Guest surface: the tab bar lives in (tabs); detail screens are pushed over it.
export default function GuestLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#fff" },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="property/[slug]" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="booking-confirmed" />
      <Stack.Screen name="trip/[id]" />
    </Stack>
  );
}
