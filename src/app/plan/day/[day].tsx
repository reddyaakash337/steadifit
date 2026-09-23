import { useLocalSearchParams } from 'expo-router';
import { PlanDayDetailScreen } from '@/features/screens';

export default function PlanDayRoute() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const dayIndex = Number(Array.isArray(day) ? day[0] : day);
  return <PlanDayDetailScreen dayIndex={Number.isInteger(dayIndex) ? dayIndex : -1} />;
}
