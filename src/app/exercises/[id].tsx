import { useLocalSearchParams } from 'expo-router';
import { ExerciseDetailsScreen } from '@/features/screens';
export default function ExerciseDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseDetailsScreen id={id} />;
}
