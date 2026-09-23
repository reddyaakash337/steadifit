import { useLocalSearchParams } from 'expo-router';
import { WorkoutCompleteScreen } from '@/features/screens';
export default function CompleteWorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutCompleteScreen id={id} />;
}
