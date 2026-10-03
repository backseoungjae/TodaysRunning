import '@/features/run/services/backgroundLocationTask';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseGate } from '@/database/DatabaseGate';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <DatabaseGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="running" options={{ gestureEnabled: false }} />
          <Stack.Screen name="runResult" />
          <Stack.Screen name="activity/[runId]" />
        </Stack>
      </DatabaseGate>
    </>
  );
}
