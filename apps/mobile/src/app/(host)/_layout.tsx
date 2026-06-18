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
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
