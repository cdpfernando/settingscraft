import '@/polyfills';

import { Cores, Fonte } from '@/styles';
import * as SystemUI from 'expo-system-ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

void SystemUI.setBackgroundColorAsync(Cores.fundoBase);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Cores.fundoBase },
          headerShadowVisible: false,
          headerTintColor: Cores.textoPrimario,
          headerTitleStyle: { fontWeight: Fonte.pesoSemibold },
          contentStyle: { backgroundColor: Cores.fundoBase },
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'SettingsCraft' }} />
        <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
      </Stack>
    </>
  );
}
