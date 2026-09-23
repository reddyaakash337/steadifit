import { useLocalSearchParams } from 'expo-router';
import { WorkoutHistoryDetailsScreen } from '@/features/screens';
export default function WorkoutHistoryDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutHistoryDetailsScreen id={id} />;
}
