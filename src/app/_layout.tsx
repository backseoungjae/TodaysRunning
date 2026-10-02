import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="running" />
        <Stack.Screen name="runResult" />
        <Stack.Screen name="activity/[runId]" />
      </Stack>
    </>
  );
}
