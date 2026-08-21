import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useTheme } from '../src/theme/useTheme';
import { initializeAuthListener, useAuthStore } from '../src/store/authStore';
import { useProfileStore } from '../src/store/profileStore';
import { useWalletStore } from '../src/store/walletStore';
import { useCustomerStore } from '../src/store/customerStore';
import { resetAllUserData } from '../src/store/dataLifecycle';
// Task 10-11 add useTemplateStore/useRequestStore/useRequestEventStore/
// useTransactionStore imports here, and their loadForUser(userId) calls
// alongside profile/wallet/customers' below, as each store is migrated.

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { mode, colors } = useTheme();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pay" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const unsubscribe = initializeAuthListener();
    return unsubscribe;
  }, []);

  const userId = useAuthStore((state) => state.user?.id);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const fullName = useAuthStore((state) => state.user?.fullName);
  const lastLoadedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!authHasHydrated) return;

    if (!userId) {
      if (lastLoadedUserId.current !== null) {
        resetAllUserData();
        lastLoadedUserId.current = null;
      }
      return;
    }

    if (lastLoadedUserId.current === userId) return;
    resetAllUserData();
    lastLoadedUserId.current = userId;
    useProfileStore.getState().loadForUser(userId, fullName);
    useWalletStore.getState().loadForUser(userId);
    useCustomerStore.getState().loadForUser(userId);
  }, [authHasHydrated, userId, fullName]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
