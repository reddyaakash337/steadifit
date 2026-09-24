import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SteadiifitColors } from '@/constants/theme';
import { WelcomeScreen } from '@/features/screens';
import { useSteadiifit } from '@/state/AppContext';

export default function IndexRoute() {
  const { profileLoaded, onboardingCompleted } = useSteadiifit();

  if (!profileLoaded) {
    return <View style={styles.loading}><ActivityIndicator color={SteadiifitColors.accent} size="large" /></View>;
  }
  if (onboardingCompleted) return <Redirect href="/(tabs)/home" />;
  return <WelcomeScreen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: SteadiifitColors.background, alignItems: 'center', justifyContent: 'center' },
});
