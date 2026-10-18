import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LoginSheet } from "@/components/auth/login-sheet";
import { useAuthStore } from "@/lib/auth-store";
import { deviceStore } from "@/lib/device-store";
import { useLocationStore } from "@/lib/location-store";
import { queryClient } from "@/lib/query-client";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const hydrated = useAuthStore((state) => state.hydrated);
  // Prices depend on location, so the first requests must already carry the saved point.
  const locationHydrated = useLocationStore((state) => state.hydrated);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const ready = fontsLoaded && hydrated && locationHydrated && onboarded !== null;

  useEffect(() => {
    useAuthStore.getState().hydrate();
    useLocationStore.getState().hydrate();
    deviceStore
      .isOnboarded()
      .catch(() => true)
      .then(setOnboarded);
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    // First launch only; the flag is device-local (lib/device-store.ts).
    if (!onboarded) router.replace("/onboarding");
  }, [ready, onboarded]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
            <Stack.Screen name="login" options={{ presentation: "modal" }} />
            <Stack.Screen name="signup" options={{ presentation: "modal" }} />
            <Stack.Screen name="forgot-password" options={{ presentation: "modal" }} />
            <Stack.Screen name="order-success" options={{ gestureEnabled: false }} />
          </Stack>
          <LoginSheet />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
