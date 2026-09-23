import type { Exercise, Workout } from '@/data/catalog';
import type {
  BodyWeightEntry, CoachConversation, CoachMessage, NutritionEntry, PlanDay, PlanExercise,
  Profile, SteadiifitSnapshot, UserSettings, WorkoutHistoryItem, WorkoutPlan, WorkoutSession,
} from '@/types/domain';

export type RepositoryListener = () => void;

/** Domain-oriented contract used by AppContext; mutations never receive app-wide state. */
export interface SteadiifitRepository {
  getSnapshot(): SteadiifitSnapshot;
  subscribe(listener: RepositoryListener): () => void;

  getProfile(): Profile;
  updateProfile(profile: Profile): void;
  getSettings(): UserSettings;
  updateSettings(settings: UserSettings): void;

  getExercises(): Exercise[];
  getWorkoutTemplates(): Workout[];
  getFavoriteExerciseIds(): string[];
  toggleFavorite(exerciseId: string): void;

  getActivePlan(): WorkoutPlan;
  savePlan(plan: WorkoutPlan): void;
  addPlanExercise(dayId: string, exercise: Omit<PlanExercise, 'id' | 'position'>, summary: Pick<PlanDay, 'focus' | 'duration'>): PlanExercise | null;
  replacePlanExercise(dayId: string, planExerciseId: string, exerciseId: string, summary: Pick<PlanDay, 'focus' | 'duration'>): boolean;
  removePlanExercise(dayId: string, planExerciseId: string, summary: Pick<PlanDay, 'focus' | 'duration'>): boolean;
  resetPlan(plan: WorkoutPlan): void;

  createWorkoutSession(session: WorkoutSession): void;
  updateWorkoutSession(session: WorkoutSession): void;
  completeWorkoutSession(historyItem: WorkoutHistoryItem, plan?: WorkoutPlan): void;
  discardWorkoutSession(): void;
  getWorkoutHistory(): WorkoutHistoryItem[];
  getWorkoutSession(id: string): WorkoutSession | null;
  clearWorkoutHistory(): void;

  getBodyweightEntries(): BodyWeightEntry[];
  addBodyweightEntry(entry: BodyWeightEntry): void;

  getNutritionEntries(date?: string): NutritionEntry[];
  addNutritionEntry(entry: NutritionEntry): void;
  removeNutritionEntry(id: string): void;
  clearNutritionEntries(): void;

  getCoachConversation(): CoachConversation;
  appendCoachMessage(message: CoachMessage): void;
  clearCoachConversation(conversationId: string): void;

  resetAllData(data: { profile: Profile; settings: UserSettings; plan: WorkoutPlan; coachConversationId: string }): void;
}

/** Snapshot construction helper shared by AppContext and the in-memory adapter. */
export type { PlanDay, SteadiifitSnapshot };
