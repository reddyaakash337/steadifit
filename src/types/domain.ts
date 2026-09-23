import type { WeightUnit } from '@/features/units';

export type Goal = 'Build muscle' | 'Get stronger' | 'Lose fat' | 'Stay consistent';
export type TrainingFocus = 'Balanced' | 'Full Body' | 'Upper Body' | 'Lower Body' | 'Push' | 'Pull' | 'Legs' | 'Strength' | 'Hypertrophy';
export type PlanPreferences = { goal: Goal; experience: string; frequency: number; equipment: string; duration: number; focus: TrainingFocus };
export type WorkoutSettings = { defaultRestSeconds: number; autoStartRest: boolean };

export type Profile = {
  name: string;
  goal: Goal;
  experience: string;
  equipment: string;
  frequency: number;
  duration: number;
  trainingFocus: TrainingFocus;
};
export type UserSettings = { units: WeightUnit; workoutSettings: WorkoutSettings };

export type PlanExercise = { id: string; exerciseId: string; position: number; sets: number; repRange: string; restSeconds: number };
export type PlanDay = {
  id: string;
  weekday: number;
  /** Compatibility alias for existing screens and plan helpers. */
  day: number;
  workoutId: string | null;
  status: 'upcoming' | 'done' | 'skipped';
  title?: string;
  focus?: string;
  duration?: number;
  exercises?: PlanExercise[];
};
export type WorkoutPlan = { id: string; startedAt: number; preferences: PlanPreferences; days: PlanDay[] };

export type WorkoutSet = { id: string; setNumber: number; weight: number; reps: number; completed?: boolean; completedAt?: number };
export type WorkoutSessionExercise = {
  id: string;
  position: number;
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  repUnit: 'reps' | 'sec' | 'min';
  restSeconds?: number;
  skipped: boolean;
  sets: WorkoutSet[];
};
export type WorkoutSession = {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: number;
  elapsedSeconds: number;
  paused: boolean;
  units: WeightUnit;
  exercises: WorkoutSessionExercise[];
  exerciseIndex: number;
  setIndex: number;
  restSeconds: number | null;
  restActive: boolean;
};
export type WorkoutHistoryItem = {
  id: string;
  workoutId: string;
  name: string;
  date: string;
  completedAt?: number;
  duration: number;
  volume: number;
  units?: WeightUnit;
  personalRecord: boolean;
  personalRecords?: { exerciseId: string; weight: number; reps: number }[];
  exercises: Pick<WorkoutSessionExercise, 'id' | 'position' | 'exerciseId' | 'skipped' | 'sets'>[];
};

export type BodyWeightEntry = { id: string; recordedAt: number; weight: number; units: WeightUnit };
export type FoodMeal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type NutritionEntry = { id: string; date: string; meal: FoodMeal; name: string; calories: number; protein: number; carbs: number; fat: number };
export type CoachConversation = { id: string; messages: CoachMessage[] };
export type CoachMessage = { id: string; role: 'user' | 'assistant'; text: string; timestamp: number };

/** Read-only state snapshot consumed by AppContext; repository mutations use domain methods. */
export type SteadiifitSnapshot = Profile & UserSettings & {
  planId: string;
  planStartedAt: number;
  coachConversationId: string;
  plan: PlanDay[];
  history: WorkoutHistoryItem[];
  bodyWeightEntries: BodyWeightEntry[];
  foodEntries: NutritionEntry[];
  coachMessages: CoachMessage[];
  activeWorkout: WorkoutSession | null;
  favoriteExerciseIds: string[];
};
