import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppColors } from '@/constants/theme';
import { TabButton } from '@/shared/components/TabButton';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIcon: () => null,
        tabBarStyle: {
          backgroundColor: AppColors.background,
          height: 52 + insets.bottom,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarAccessibilityLabel: '홈',
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label="홈"
              icon={{ ios: 'house', android: 'home', web: 'home' }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="run"
        options={{
          title: '러닝',
          tabBarAccessibilityLabel: '러닝',
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label="러닝"
              icon={{ ios: 'figure.run', android: 'directions_run', web: 'directions_run' }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: '활동',
          tabBarAccessibilityLabel: '활동',
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label="활동"
              icon={{ ios: 'clock', android: 'history', web: 'history' }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarAccessibilityLabel: '설정',
          tabBarButton: (props) => (
            <TabButton
              {...props}
              label="설정"
              icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
