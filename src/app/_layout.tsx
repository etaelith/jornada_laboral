import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '@/application/app-context';
import { AppLock } from '@/security/app-lock';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppLock>
          <AppProvider>
            <StatusBar style="auto" />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="day/[date]" options={{ title: 'Detalle del día' }} />
              <Stack.Screen name="profile" options={{ title: 'Perfil laboral' }} />
              <Stack.Screen name="export" options={{ title: 'Importar y exportar' }} />
            </Stack>
          </AppProvider>
        </AppLock>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
