import type { ImageSourcePropType } from 'react-native';

export type WorkoutImageCategory = 'lower-body' | 'upper-body' | 'push' | 'pull' | 'legs' | 'core' | 'full-body' | 'mobility';

const workoutImages: Record<WorkoutImageCategory, ImageSourcePropType> = {
  'lower-body': require('@/assets/images/workouts/lower-body.png'),
  'upper-body': require('@/assets/images/workouts/upper-body.png'),
  push: require('@/assets/images/workouts/push.png'),
  pull: require('@/assets/images/workouts/pull.png'),
  legs: require('@/assets/images/workouts/legs.png'),
  core: require('@/assets/images/workouts/core.png'),
  'full-body': require('@/assets/images/workouts/full-body.png'),
  mobility: require('@/assets/images/workouts/mobility.png'),
};

const workoutIdCategories: Record<string, WorkoutImageCategory> = {
  push: 'push',
  pull: 'pull',
  legs: 'legs',
  full: 'full-body',
  shoulders: 'upper-body',
};

export function workoutImageForCategory(category?: string | null): ImageSourcePropType | null {
  if (!category) return null;
  const normalized = category.trim().toLowerCase().replace(/\s+/g, '-');
  return Object.hasOwn(workoutImages, normalized)
    ? workoutImages[normalized as WorkoutImageCategory]
    : null;
}

export function workoutImageForPlanDay(title?: string | null, focus?: string | null, workoutId?: string | null): ImageSourcePropType | null {
  const titleImage = workoutImageForCategory(title);
  if (titleImage) return titleImage;

  const focusImage = workoutImageForCategory(focus);
  if (focusImage) return focusImage;

  const idCategory = workoutId ? workoutIdCategories[workoutId] : undefined;
  return idCategory ? workoutImages[idCategory] : workoutImageForCategory(workoutId);
}

export function workoutImageForWorkout(workout: { id: string; name: string; focus: string }): ImageSourcePropType | null {
  return workoutImageForPlanDay(workout.name, workout.focus, workout.id);
}