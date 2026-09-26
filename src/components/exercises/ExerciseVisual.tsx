import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { exerciseVisualForId } from '@/features/exerciseVisuals';

export function ExerciseVisual({ exerciseId, style }: {
  exerciseId: string;
  style: StyleProp<ImageStyle>;
}) {
  const visual = exerciseVisualForId(exerciseId);
  if (!visual) return null;

  return <Image
    source={visual.image}
    resizeMode="contain"
    style={style}
    accessible
    accessibilityLabel={`${visual.exerciseName} illustration`}
  />;
}