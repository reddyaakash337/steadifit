import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BricolageGrotesque_700Bold from '@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf';
import BricolageGrotesque_800ExtraBold from '@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf';
import Inter_400Regular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf';
import Inter_600SemiBold from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf';
import Inter_700Bold from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf';
import { AppProvider } from '@/state/AppContext';
import { AuthProvider, useAuth } from '@/state/AuthContext';
import { SteadiifitColors } from '@/constants/theme';

function RootNavigator() {
  const { status } = useAuth();

  return <View style={styles.root}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: SteadiifitColors.background }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={status !== 'unauthenticated'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="plan-generated" options={{ gestureEnabled: false }} />
        <Stack.Screen name="plan/customize" />
        <Stack.Screen name="plan/day/[day]" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="active/[id]" />
        <Stack.Screen name="complete/[id]" />
        <Stack.Screen name="history/index" />
        <Stack.Screen name="history/[id]" />
        <Stack.Screen name="progress/exercise/[id]" />
        <Stack.Screen name="progress/body-weight" />
        <Stack.Screen name="exercises/index" />
        <Stack.Screen name="exercises/[id]" />
        <Stack.Screen name="nutrition/add" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="profile/personal-information" />
        <Stack.Screen name="about" />
      </Stack.Protected>
      <Stack.Screen name="auth" />
    </Stack>
    {status === 'loading' ? <View accessibilityViewIsModal style={styles.loading}>
      <ActivityIndicator accessibilityLabel="Restoring authentication session" color={SteadiifitColors.accent} size="large" />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { ...StyleSheet.absoluteFill, zIndex: 10, elevation: 10, backgroundColor: SteadiifitColors.background, alignItems: 'center', justifyContent: 'center' },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageBold: BricolageGrotesque_700Bold,
    BricolageExtraBold: BricolageGrotesque_800ExtraBold,
    InterRegular: Inter_400Regular,
    InterSemiBold: Inter_600SemiBold,
    InterBold: Inter_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
