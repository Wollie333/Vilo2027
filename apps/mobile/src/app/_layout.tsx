import "../global.css";

import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";

import { AuthProvider, useAuth } from "@/lib/auth/auth-provider";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/stores/app-store";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Watches auth + active-role state and keeps the user on the right route group.
function RootNavigator() {
  const { session, loading } = useAuth();
  const activeRole = useAppStore((s) => s.activeRole);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    const inAuth = group === "(auth)";

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }
    // for-hosts is a public marketing page; allow signed-in users to view it.
    if (session && inAuth && !segments.includes("for-hosts")) {
      router.replace(
        activeRole === "host"
          ? "/(host)/(tabs)/overview"
          : "/(guest)/(tabs)/home",
      );
    }
  }, [session, loading, activeRole, segments, router]);

  // When a dual-role user flips surfaces, jump to that surface's home.
  useEffect(() => {
    if (loading || !session) return;
    const group = segments[0];
    if (activeRole === "host" && group === "(guest)")
      router.replace("/(host)/(tabs)/overview");
    if (activeRole === "guest" && group === "(host)")
      router.replace("/(guest)/(tabs)/home");
  }, [activeRole, loading, session, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#fff" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(guest)" />
      <Stack.Screen name="(host)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
