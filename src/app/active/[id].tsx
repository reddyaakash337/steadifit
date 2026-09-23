import { useLocalSearchParams } from 'expo-router';
import { ActiveWorkoutScreen } from '@/features/screens';
export default function ActiveWorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ActiveWorkoutScreen id={id} />;
}
