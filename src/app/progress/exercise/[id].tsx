import { useLocalSearchParams } from 'expo-router';
import { ExerciseProgressScreen } from '@/features/screens';

export default function ExerciseProgressRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseProgressScreen id={Array.isArray(id) ? id[0] : id} />;
}
