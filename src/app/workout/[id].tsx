import { useLocalSearchParams } from 'expo-router';
import { WorkoutDetailsScreen } from '@/features/screens';
export default function WorkoutDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutDetailsScreen id={id} />;
}
