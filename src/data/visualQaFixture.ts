import { exerciseById, workouts } from '@/data/catalog';
import type { BodyWeightEntry, NutritionEntry, PlanDay, SteadiifitSnapshot, WorkoutHistoryItem } from '@/types/domain';
import { localDateKey } from '@/features/nutrition';

const WEEKLY_WORKOUT_IDS = ['push', 'pull', null, 'legs', 'shoulders', 'full', null] as const;

function makeHistoryItem(workoutId: string, completedAt: number, sequence: number): WorkoutHistoryItem {
  const workout = workouts.find(item => item.id === workoutId) ?? workouts[0];
  const exercises = workout.exerciseIds.map((exerciseId, position) => {
    const exercise = exerciseById(exerciseId);
    const baseWeight = exercise.equipment === 'Bodyweight' ? 0 : 20 + sequence * 2.5 + position * 2.5;
    return {
      id: `visual-qa-session-${sequence}-exercise-${exerciseId}`,
      position,
      exerciseId,
      skipped: false,
      sets: [1, 2, 3].map(setNumber => ({
        id: `visual-qa-session-${sequence}-${exerciseId}-set-${setNumber}`,
        setNumber,
        weight: baseWeight,
        reps: Math.max(6, 12 - setNumber),
        completed: true,
        completedAt,
      })),
    };
  });
  const volume = exercises.reduce((sum, item) => sum + item.sets.reduce((setTotal, set) => setTotal + set.weight * set.reps, 0), 0);
  const hasBench = workout.exerciseIds.includes('bench');

  return {
    id: `visual-qa-session-${sequence}`,
    workoutId,
    name: workout.name,
    date: new Date(completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    completedAt,
    duration: workout.duration,
    volume,
    units: 'kg',
    personalRecord: hasBench && sequence === 0,
    personalRecords: hasBench && sequence === 0 ? [{ exerciseId: 'bench', weight: 60, reps: 8 }] : [],
    exercises,
  };
}

/** Local-only fixture data for explicitly opted-in development visual QA. */
export function createVisualQaSnapshot(base: SteadiifitSnapshot): SteadiifitSnapshot {
  const now = new Date();
  const today = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - today);
  const plan: PlanDay[] = WEEKLY_WORKOUT_IDS.map((workoutId, weekday) => {
    const workout = workoutId ? workouts.find(item => item.id === workoutId) : undefined;
    return {
      id: `visual-qa-plan-${weekday}`,
      weekday,
      day: weekday,
      workoutId,
      status: 'upcoming',
      ...(workout ? {
        focus: workout.focus,
        duration: workout.duration,
        exercises: workout.exerciseIds.map((exerciseId, position) => {
          const exercise = exerciseById(exerciseId);
          return {
            id: `visual-qa-plan-${weekday}-exercise-${position}`,
            exerciseId,
            position,
            sets: exercise.sets,
            repRange: exercise.repRange,
            restSeconds: exercise.restSeconds,
          };
        }),
      } : { exercises: [] }),
    };
  });

  const completedSlots = plan.filter(day => day.workoutId && day.weekday < today);
  const history = completedSlots.map((day, index) => {
    const completedAt = new Date(weekStart);
    completedAt.setDate(completedAt.getDate() + day.weekday);
    completedAt.setHours(17, 30, 0, 0);
    return makeHistoryItem(day.workoutId!, completedAt.getTime(), index);
  }).sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));

  const latestWeight: BodyWeightEntry = {
    id: 'visual-qa-weight-current',
    recordedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8).getTime(),
    weight: 78.4,
    units: 'kg',
  };
  const previousWeight: BodyWeightEntry = {
    id: 'visual-qa-weight-previous',
    recordedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 8).getTime(),
    weight: 79.1,
    units: 'kg',
  };
  const foodDate = localDateKey(now);
  const foodEntries: NutritionEntry[] = [
    { id: 'visual-qa-food-breakfast', date: foodDate, meal: 'Breakfast', name: 'Greek yogurt and oats', calories: 420, protein: 28, carbs: 55, fat: 10, quantity: 1, servingUnit: 'bowl' },
    { id: 'visual-qa-food-lunch', date: foodDate, meal: 'Lunch', name: 'Chicken rice bowl', calories: 640, protein: 42, carbs: 72, fat: 18, quantity: 1, servingUnit: 'plate' },
    { id: 'visual-qa-food-snack', date: foodDate, meal: 'Snack', name: 'Banana and whey', calories: 260, protein: 24, carbs: 32, fat: 4, quantity: 1, servingUnit: 'serving' },
  ];

  return {
    ...base,
    name: 'Alex',
    goal: 'Build muscle',
    experience: 'Some Experience',
    equipment: 'Full Gym',
    frequency: 5,
    duration: 45,
    trainingFocus: 'Balanced',
    units: 'kg',
    planId: 'visual-qa-plan',
    planStartedAt: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    coachConversationId: 'visual-qa-coach',
    plan,
    history,
    bodyWeightEntries: [latestWeight, previousWeight],
    foodEntries,
    activeWorkout: null,
    favoriteExerciseIds: ['bench', 'squat'],
    coachMessages: [],
  };
}
