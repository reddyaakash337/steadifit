import { exercises } from '@/data/catalog';
import type { Exercise, Workout } from '@/data/catalog';
import type { ImageSourcePropType } from 'react-native';

const illustrationByExerciseId: Partial<Record<Exercise['id'], ImageSourcePropType>> = {
  squat: require('../../assets/images/exercises/barbell-squat.png'),
  bench: require('../../assets/images/exercises/bench-press.png'),
  pulldown: require('../../assets/images/exercises/lat-pulldown.png'),
  'cable-row': require('../../assets/images/exercises/cable-row.png'),
  'db-shoulder-press': require('../../assets/images/exercises/seated-dumbbell-press.png'),
  rdl: require('../../assets/images/exercises/romanian-deadlift.png'),
  lunges: require('../../assets/images/exercises/forward-lunge.png'),
  plank: require('../../assets/images/exercises/plank.png'),
};

const landscapeExerciseIds = new Set(['bench', 'cable-row', 'plank']);

export type ExerciseVisual = {
  exerciseId: string;
  exerciseName: string;
  image: ImageSourcePropType;
  category: Exercise['category'];
  orientation: 'landscape' | 'portrait';
};

export function exerciseVisualForId(exerciseId?: string): ExerciseVisual | undefined {
  if (!exerciseId) return undefined;

  const exercise = exercises.find(item => item.id === exerciseId);
  const image = illustrationByExerciseId[exerciseId];
  return exercise && image
    ? {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      image,
      category: exercise.category,
      orientation: landscapeExerciseIds.has(exercise.id) ? 'landscape' : 'portrait',
    }
    : undefined;
}

export function exerciseVisualForWorkout(workout: Pick<Workout, 'id' | 'exerciseIds'>, previousExerciseId?: string): ExerciseVisual | undefined {
  if (workout.id === 'shoulders') {
    const shoulderPressVisual = exerciseVisualForId('db-shoulder-press');
    if (shoulderPressVisual && shoulderPressVisual.exerciseId !== previousExerciseId) return shoulderPressVisual;
  }

  for (const exerciseId of workout.exerciseIds) {
    if (exerciseId === previousExerciseId) continue;
    const visual = exerciseVisualForId(exerciseId);
    if (visual) return visual;
  }

  return undefined;
}