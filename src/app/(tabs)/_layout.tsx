import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { SteadiifitColors as C } from '@/constants/theme';

const tabGlyphs: Record<string, string> = { home: '⌂', train: '◇', progress: '↗' };

export default function MainTabs() {
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: C.ink,
    tabBarInactiveTintColor: C.muted,
    tabBarLabelStyle: { fontSize: 9, fontWeight: '600', fontFamily: 'InterSemiBold', marginBottom: 2 },
    tabBarStyle: { height: 60, paddingTop: 4, paddingBottom: 5, borderTopColor: C.line, backgroundColor: C.background },
    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22, lineHeight: 25 }}>{tabGlyphs[route.name] ?? ''}</Text>,
  })}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Screen name="train" options={{ title: 'Train' }} />
    <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    <Tabs.Screen name="plan" options={{ href: null }} />
    <Tabs.Screen name="workouts" options={{ href: null }} />
    <Tabs.Screen name="nutrition" options={{ href: null }} />
    <Tabs.Screen name="profile" options={{ href: null }} />
  </Tabs>;
}
