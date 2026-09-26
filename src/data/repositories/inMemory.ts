import { exercises, workouts } from '@/data/catalog';
import type {
  BodyWeightEntry, CoachConversation, CoachMessage, NutritionEntry, PlanDay, PlanExercise, Profile,
  SteadiifitSnapshot, UserSettings, WorkoutHistoryItem, WorkoutPlan, WorkoutSession,
} from '@/types/domain';
import { createId } from '@/utils/ids';
import type { RepositoryListener, SteadiifitRepository } from '@/data/repositories/types';

const planPreferences = (state: SteadiifitSnapshot): WorkoutPlan['preferences'] => ({
  goal: state.goal,
  experience: state.experience,
  frequency: state.frequency,
  equipment: state.equipment,
  duration: state.duration,
  focus: state.trainingFocus,
});

/** Synchronous in-memory adapter. Its internal snapshot is the app's single source of truth. */
export class InMemorySteadiifitRepository implements SteadiifitRepository {
  private state: SteadiifitSnapshot;
  private listeners = new Set<RepositoryListener>();

  constructor(initialState: SteadiifitSnapshot) {
    this.state = initialState;
  }

  getSnapshot = (): SteadiifitSnapshot => this.state;

  subscribe = (listener: RepositoryListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private commit(next: SteadiifitSnapshot): void {
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  private applyPlan(plan: WorkoutPlan): void {
    this.commit({
      ...this.state,
      planId: plan.id,
      planStartedAt: plan.startedAt,
      goal: plan.preferences.goal,
      experience: plan.preferences.experience,
      frequency: plan.preferences.frequency,
      equipment: plan.preferences.equipment,
      duration: plan.preferences.duration,
      trainingFocus: plan.preferences.focus,
      plan: plan.days,
    });
  }

  getProfile = (): Profile => ({
    name: this.state.name,
    goal: this.state.goal,
    experience: this.state.experience,
    equipment: this.state.equipment,
    frequency: this.state.frequency,
    duration: this.state.duration,
    trainingFocus: this.state.trainingFocus,
  });

  updateProfile = (profile: Profile): void => this.commit({ ...this.state, ...profile });

  getSettings = (): UserSettings => ({ units: this.state.units, workoutSettings: this.state.workoutSettings });

  updateSettings = (settings: UserSettings): void => this.commit({ ...this.state, ...settings });

  getExercises = () => exercises;

  getWorkoutTemplates = () => workouts;

  getFavoriteExerciseIds = () => this.state.favoriteExerciseIds;

  toggleFavorite = (exerciseId: string): void => {
    const favoriteExerciseIds = this.state.favoriteExerciseIds.includes(exerciseId)
      ? this.state.favoriteExerciseIds.filter(id => id !== exerciseId)
      : [...this.state.favoriteExerciseIds, exerciseId];
    this.commit({ ...this.state, favoriteExerciseIds });
  };

  getActivePlan = (): WorkoutPlan => ({
    id: this.state.planId,
    startedAt: this.state.planStartedAt,
    preferences: planPreferences(this.state),
    days: this.state.plan,
  });

  savePlan = (plan: WorkoutPlan): void => this.applyPlan(plan);

  addPlanExercise = (dayId: string, exercise: Omit<PlanExercise, 'id' | 'position'>, summary: Pick<PlanDay, 'focus' | 'duration'>): PlanExercise | null => {
    const day = this.state.plan.find(item => item.id === dayId);
    if (!day?.workoutId || day.exercises?.some(item => item.exerciseId === exercise.exerciseId)) return null;
    const nextExercise: PlanExercise = { ...exercise, id: createId(), position: day.exercises?.length ?? 0 };
    const plan = this.state.plan.map(item => item.id === dayId ? { ...item, ...summary, exercises: [...(item.exercises ?? []), nextExercise] } : item);
    this.commit({ ...this.state, plan });
    return nextExercise;
  };

  replacePlanExercise = (dayId: string, planExerciseId: string, exerciseId: string, summary: Pick<PlanDay, 'focus' | 'duration'>): boolean => {
    const day = this.state.plan.find(item => item.id === dayId);
    if (!day?.exercises?.some(item => item.id === planExerciseId)) return false;
    const plan = this.state.plan.map(item => item.id === dayId
      ? { ...item, ...summary, exercises: item.exercises?.map(exercise => exercise.id === planExerciseId ? { ...exercise, exerciseId } : exercise) }
      : item);
    this.commit({ ...this.state, plan });
    return true;
  };

  removePlanExercise = (dayId: string, planExerciseId: string, summary: Pick<PlanDay, 'focus' | 'duration'>): boolean => {
    const day = this.state.plan.find(item => item.id === dayId);
    if (!day?.exercises || day.exercises.length <= 1 || !day.exercises.some(item => item.id === planExerciseId)) return false;
    const plan = this.state.plan.map(item => {
      if (item.id !== dayId) return item;
      const exercisesForDay = (item.exercises ?? []).filter(exercise => exercise.id !== planExerciseId)
        .map((exercise, position) => ({ ...exercise, position }));
      return { ...item, ...summary, exercises: exercisesForDay };
    });
    this.commit({ ...this.state, plan });
    return true;
  };

  resetPlan = (plan: WorkoutPlan): void => this.applyPlan(plan);

  createWorkoutSession = (session: WorkoutSession): void => this.commit({ ...this.state, activeWorkout: session });

  updateWorkoutSession = (session: WorkoutSession): void => {
    if (this.state.activeWorkout?.id === session.id) this.commit({ ...this.state, activeWorkout: session });
  };

  completeWorkoutSession = (historyItem: WorkoutHistoryItem, plan?: WorkoutPlan): void => {
    const next = { ...this.state, activeWorkout: null, history: [historyItem, ...this.state.history] };
    if (plan) {
      next.planId = plan.id;
      next.planStartedAt = plan.startedAt;
      next.goal = plan.preferences.goal;
      next.experience = plan.preferences.experience;
      next.frequency = plan.preferences.frequency;
      next.equipment = plan.preferences.equipment;
      next.duration = plan.preferences.duration;
      next.trainingFocus = plan.preferences.focus;
      next.plan = plan.days;
    }
    this.commit(next);
  };

  discardWorkoutSession = (): void => {
    if (this.state.activeWorkout) this.commit({ ...this.state, activeWorkout: null });
  };

  getWorkoutHistory = () => this.state.history;

  getWorkoutSession = (id: string): WorkoutSession | null => this.state.activeWorkout?.id === id ? this.state.activeWorkout : null;

  clearWorkoutHistory = (): void => this.commit({ ...this.state, history: [] });

  getBodyweightEntries = () => this.state.bodyWeightEntries;

  addBodyweightEntry = (entry: BodyWeightEntry): void => this.commit({ ...this.state, bodyWeightEntries: [entry, ...this.state.bodyWeightEntries] });

  getNutritionEntries = (date?: string): NutritionEntry[] => date
    ? this.state.foodEntries.filter(entry => entry.date === date)
    : this.state.foodEntries;

  addNutritionEntry = (entry: NutritionEntry): void => this.commit({ ...this.state, foodEntries: [entry, ...this.state.foodEntries] });

  updateNutritionEntry = (entry: NutritionEntry): void => this.commit({ ...this.state, foodEntries: this.state.foodEntries.map(item => item.id === entry.id ? entry : item) });

  removeNutritionEntry = (id: string): void => this.commit({ ...this.state, foodEntries: this.state.foodEntries.filter(entry => entry.id !== id) });

  clearNutritionEntries = (): void => this.commit({ ...this.state, foodEntries: [] });

  getCoachConversation = (): CoachConversation => ({ id: this.state.coachConversationId, messages: this.state.coachMessages });

  appendCoachMessage = (message: CoachMessage): void => this.commit({ ...this.state, coachMessages: [...this.state.coachMessages, message] });

  clearCoachConversation = (conversationId: string): void => this.commit({ ...this.state, coachConversationId: conversationId, coachMessages: [] });

  resetAllData = (data: { profile: Profile; settings: UserSettings; plan: WorkoutPlan; coachConversationId: string }): void => {
    this.commit({
      ...this.state,
      ...data.profile,
      ...data.settings,
      planId: data.plan.id,
      planStartedAt: data.plan.startedAt,
      plan: data.plan.days,
      coachConversationId: data.coachConversationId,
      activeWorkout: null,
      favoriteExerciseIds: [],
      bodyWeightEntries: [],
      history: [],
      foodEntries: [],
      coachMessages: [],
    });
  };
}
