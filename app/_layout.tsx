import { Cores } from '@/styles';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Cores.fundoCard },
          headerTintColor: Cores.textoPrimario,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Cores.fundoBase },
        }}
      />
    </>
  );
}
