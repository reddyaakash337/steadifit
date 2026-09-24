import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { exerciseById, PlanDay, PlannedExercise, workoutById } from '@/data/catalog';
import { estimateWorkoutDuration, generateWorkoutPlan, PlanPreferences, plannedExercises } from '@/features/plan';
import { convertWeight } from '@/features/units';
import type { WeightUnit } from '@/features/units';
import type {
  BodyWeightEntry, CoachConversation, CoachMessage, FoodMeal, Goal, NutritionEntry, Profile,
  SteadiifitSnapshot, UserSettings, WorkoutHistoryItem, WorkoutPlan, WorkoutSession,
  WorkoutSessionExercise, WorkoutSet, WorkoutSettings,
} from '@/types/domain';
import { createId } from '@/utils/ids';
import { InMemorySteadiifitRepository } from '@/data/repositories/inMemory';
import type { SteadiifitRepository } from '@/data/repositories/types';
import { profileRepository } from '@/data/repositories/profile';
import { settingsRepository } from '@/data/repositories/settings';
import { planRepository } from '@/data/repositories/plan';
import { useAuth } from '@/state/AuthContext';

export type { BodyWeightEntry, CoachMessage, FoodMeal, Goal, WorkoutHistoryItem, WorkoutSettings, WorkoutSet } from '@/types/domain';
export type FoodEntry = NutritionEntry;
export type SessionExercise = WorkoutSessionExercise;
export type ActiveWorkoutSession = WorkoutSession;
export type SteadiifitState = SteadiifitSnapshot;

const defaultPreferences: PlanPreferences = { goal: 'Build muscle', experience: 'Some Experience', frequency: 4, equipment: 'Full Gym', duration: 45, focus: 'Balanced' };
const createPlan = (preferences: PlanPreferences, days = generateWorkoutPlan(preferences)): WorkoutPlan => ({ id: createId(), startedAt: Date.now(), preferences, days });
const createInitialState = (): SteadiifitState => ({
  name: 'Alex', goal: defaultPreferences.goal, experience: defaultPreferences.experience, equipment: defaultPreferences.equipment, frequency: defaultPreferences.frequency,
  units: 'kg', duration: defaultPreferences.duration, trainingFocus: defaultPreferences.focus,
  planId: createId(), planStartedAt: Date.now(), coachConversationId: createId(), plan: generateWorkoutPlan(defaultPreferences),
  activeWorkout: null, favoriteExerciseIds: [], bodyWeightEntries: [], workoutSettings: { defaultRestSeconds: 90, autoStartRest: true, soundEnabled: true, vibrationEnabled: true },
  history: [], foodEntries: [], coachMessages: [],
});
const createProfile = (value: Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency' | 'duration' | 'trainingFocus'>): Profile => ({
  name: value.name, goal: value.goal, experience: value.experience, equipment: value.equipment,
  frequency: value.frequency, duration: value.duration, trainingFocus: value.trainingFocus,
});
const createPlanPreferences = (profile: Profile): PlanPreferences => ({
  goal: profile.goal, experience: profile.experience, frequency: profile.frequency, equipment: profile.equipment,
  duration: profile.duration, focus: profile.trainingFocus,
});

type Onboarding = Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency'>;
type ContextValue = {
  state: SteadiifitState; finishOnboarding: (value: Onboarding) => void; saveProfile: (profile: Profile) => void; setUnits: (units: 'kg' | 'lb') => void; toggleFavorite: (exerciseId: string) => void;
  startWorkout: (workoutId: string) => void; updateSet: (weight: number, reps: number) => void; completeSet: () => void;
  startSingleExercise: (exerciseId: string) => void;
  setRest: (seconds: number | null, active?: boolean) => void; advanceWorkout: () => void; skipExercise: () => void;
  replaceExercise: (exerciseId: string) => void; addExercise: (exerciseId: string) => void; togglePause: () => void;
  tickWorkout: () => void; finishWorkout: () => WorkoutHistoryItem | null; discardWorkout: () => void; logBodyWeight: (weight: number) => void;
  regeneratePlan: (preferences: PlanPreferences, name?: string) => void; startPlanWorkout: (dayIndex: number) => string | null;
  replacePlanExercise: (dayIndex: number, exerciseIndex: number, exerciseId: string) => void; addPlanExercise: (dayIndex: number, exerciseId: string) => void; removePlanExercise: (dayIndex: number, exerciseIndex: number) => boolean;
  addFood: (entry: Omit<FoodEntry, 'id' | 'date'>) => void; removeFood: (id: string) => void; appendCoachMessage: (message: Omit<CoachMessage, 'id' | 'timestamp'>) => void; clearCoachMessages: () => void;
  updateName: (name: string) => void; updateWorkoutSettings: (settings: Partial<WorkoutSettings>) => void;
  clearWorkoutHistory: () => void; clearNutritionData: () => void; resetPlan: () => void; resetAppData: () => void;
};
const Context = createContext<ContextValue | null>(null);

const makeSessionExercise = (exerciseId: string, history: WorkoutHistoryItem[], units: WeightUnit, position: number, prescription?: PlannedExercise): SessionExercise => {
  const exercise = exerciseById(exerciseId);
  const targetSets = prescription?.sets ?? exercise.sets; const targetReps = prescription?.repRange ?? exercise.repRange;
  const parsedReps = targetReps.split(/[–-]/).pop()?.trim() || '10';
  const reps = Number(parsedReps.match(/\d+/)?.[0]) || 10;
  const repUnit = /min/i.test(parsedReps) ? 'min' : /sec/i.test(parsedReps) ? 'sec' : 'reps';
  const priorWorkout = history.find(item => item.exercises.some(entry => entry.exerciseId === exerciseId));
  const priorSets = priorWorkout?.exercises.find(item => item.exerciseId === exerciseId)?.sets.filter(set => set.completed !== false).map(set => ({ ...set, weight: convertWeight(set.weight, priorWorkout.units ?? 'kg', units) })) ?? [];
  return { id: createId(), position, exerciseId, targetSets, targetReps, repUnit, restSeconds: prescription?.restSeconds ?? exercise.restSeconds, skipped: false,
    sets: Array.from({ length: targetSets }, (_, index) => { const previousSet = priorSets[index] ?? priorSets[priorSets.length - 1]; return { id: createId(), setNumber: index + 1, weight: previousSet?.weight ?? (exercise.equipment === 'Bodyweight' ? 0 : 20), reps: previousSet?.reps ?? reps - (index > 0 ? 1 : 0), completed: false }; }) };
};

export function AppProvider({ children }: PropsWithChildren) {
  const { status: authStatus, user } = useAuth();
  const repositoryRef = useRef<SteadiifitRepository | null>(null);
  if (!repositoryRef.current) repositoryRef.current = new InMemorySteadiifitRepository(createInitialState());
  const repository = repositoryRef.current;
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  const initialProfileRef = useRef(repository.getProfile());
  const profileInitializationRef = useRef<Promise<void> | null>(null);
  const initialSettingsRef = useRef(repository.getSettings());
  const settingsInitializationRef = useRef<Promise<void> | null>(null);
  const initialPlanRef = useRef(repository.getActivePlan());
  const planInitializationRef = useRef<Promise<void> | null>(null);
  const planWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    const initialProfile = initialProfileRef.current;
    profileInitializationRef.current = (async () => {
      const result = await profileRepository.getOrCreateCurrentProfile(initialProfile);
      if (result.error || !result.data) return;
      const current = repository.getProfile();
      if (Object.keys(initialProfile).every(key => current[key as keyof Profile] === initialProfile[key as keyof Profile])) {
        repository.updateProfile(result.data);
      }
    })();
  }, [authStatus, repository, user]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    const initialPlan = initialPlanRef.current;
    planInitializationRef.current = (async () => {
      const result = await planRepository.loadCurrentPlan();
      if (result.error) {
        console.error('Could not load the workout plan from Supabase; keeping the local plan for this session.', result.error);
        return;
      }
      if (result.data) {
        if (JSON.stringify(repository.getActivePlan()) === JSON.stringify(initialPlan)) repository.savePlan(result.data);
        return;
      }
      const saveResult = await planRepository.saveCurrentPlan(repository.getActivePlan());
      if (saveResult.error) console.error('Could not create the workout plan in Supabase; keeping the local plan for this session.', saveResult.error);
    })();
  }, [authStatus, repository, user]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    const initialSettings = initialSettingsRef.current;
    settingsInitializationRef.current = (async () => {
      const result = await settingsRepository.getOrCreateCurrentSettings(initialSettings);
      if (result.error || !result.data) return;
      const current = repository.getSettings();
      const unchanged = current.units === initialSettings.units &&
        Object.keys(initialSettings.workoutSettings).every(key => current.workoutSettings[key as keyof WorkoutSettings] === initialSettings.workoutSettings[key as keyof WorkoutSettings]);
      if (unchanged) repository.updateSettings(result.data);
    })();
  }, [authStatus, repository, user]);

  const saveProfile = (profile: Profile) => {
    repository.updateProfile(profile);
    void (async () => {
      await profileInitializationRef.current;
      const result = await profileRepository.updateCurrentProfile(profile);
      if (result.error) console.error('Could not save profile to Supabase; keeping the local profile for this session.', result.error);
    })();
  };

  const saveSettings = (settings: UserSettings) => {
    repository.updateSettings(settings);
    void (async () => {
      await settingsInitializationRef.current;
      const result = await settingsRepository.updateCurrentSettings(settings);
      if (result.error) console.error('Could not save settings to Supabase; keeping the local settings for this session.', result.error);
    })();
  };

  const persistPlan = (plan: WorkoutPlan) => {
    const save = async () => {
      await planInitializationRef.current;
      const result = await planRepository.saveCurrentPlan(plan);
      if (result.error) console.error('Could not save the workout plan to Supabase; keeping the local plan for this session.', result.error);
    };
    planWriteQueueRef.current = planWriteQueueRef.current.then(save, save);
  };

  const updatePlan = (plan: WorkoutPlan) => {
    repository.savePlan(plan);
    persistPlan(plan);
  };

  const finishOnboarding = (value: Onboarding) => {
    const profile = { ...repository.getProfile(), ...value };
    saveProfile(profile);
    updatePlan(createPlan(createPlanPreferences(profile)));
  };
  const setUnits = (units: WeightUnit) => saveSettings({ ...repository.getSettings(), units });
  const toggleFavorite = (exerciseId: string) => repository.toggleFavorite(exerciseId);

  const startWorkout = (workoutId: string) => {
    const current = repository.getSnapshot();
    if (current.activeWorkout?.workoutId === workoutId) return;
    const workout = repository.getWorkoutTemplates().find(item => item.id === workoutId) ?? workoutById(workoutId);
    repository.createWorkoutSession({ id: createId(), workoutId, workoutName: workout.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: current.units,
      exercises: workout.exerciseIds.map((id, position) => makeSessionExercise(id, repository.getWorkoutHistory(), current.units, position)),
      exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false });
  };
  const startPlanWorkout = (dayIndex: number) => {
    const current = repository.getSnapshot(); const selectedDay = current.plan[dayIndex];
    if (!selectedDay?.workoutId) return null;
    const workoutId = selectedDay.workoutId;
    if (current.activeWorkout) return workoutId;
    const template = repository.getWorkoutTemplates().find(item => item.id === selectedDay.workoutId) ?? workoutById(selectedDay.workoutId);
    const planned = plannedExercises(selectedDay);
    repository.createWorkoutSession({ id: createId(), workoutId: selectedDay.workoutId, workoutName: selectedDay.title ?? template.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: current.units,
      exercises: planned.map((item, position) => makeSessionExercise(item.exerciseId, current.history, current.units, position, item)),
      exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false });
    return workoutId;
  };
  const startSingleExercise = (exerciseId: string) => {
    const current = repository.getSnapshot(); if (current.activeWorkout) return;
    const exercise = repository.getExercises().find(item => item.id === exerciseId) ?? exerciseById(exerciseId);
    repository.createWorkoutSession({ id: createId(), workoutId: `exercise-${exerciseId}`, workoutName: exercise.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: current.units,
      exercises: [makeSessionExercise(exerciseId, current.history, current.units, 0)], exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false });
  };
  const updateWorkout = (transform: (session: WorkoutSession, current: SteadiifitSnapshot) => WorkoutSession) => {
    const current = repository.getSnapshot(); const session = current.activeWorkout;
    if (session) repository.updateWorkoutSession(transform(session, current));
  };
  const updateSet = (weight: number, reps: number) => updateWorkout((session, current) => {
    const exercisesCopy = [...session.exercises]; const ex = { ...exercisesCopy[session.exerciseIndex], sets: [...exercisesCopy[session.exerciseIndex].sets] };
    ex.sets[session.setIndex] = { ...ex.sets[session.setIndex], weight: Math.max(0, convertWeight(weight, current.units, session.units)), reps: Math.max(1, reps) };
    exercisesCopy[session.exerciseIndex] = ex; return { ...session, exercises: exercisesCopy };
  });
  const completeSet = () => updateWorkout((session, current) => {
    const exercisesCopy = [...session.exercises]; const ex = { ...exercisesCopy[session.exerciseIndex], sets: [...exercisesCopy[session.exerciseIndex].sets] };
    ex.sets[session.setIndex] = { ...ex.sets[session.setIndex], completed: true, completedAt: Date.now() }; exercisesCopy[session.exerciseIndex] = ex;
    return { ...session, exercises: exercisesCopy, restSeconds: current.workoutSettings.defaultRestSeconds, restActive: current.workoutSettings.autoStartRest };
  });
  const setRest = (seconds: number | null, active = false) => updateWorkout(session => ({ ...session, restSeconds: seconds, restActive: active }));
  const advanceWorkout = () => updateWorkout(session => {
    const ex = session.exercises[session.exerciseIndex];
    if (session.setIndex + 1 < ex.sets.length) return { ...session, setIndex: session.setIndex + 1, restSeconds: null, restActive: false };
    if (session.exerciseIndex + 1 < session.exercises.length) return { ...session, exerciseIndex: session.exerciseIndex + 1, setIndex: 0, restSeconds: null, restActive: false };
    return session;
  });
  const skipExercise = () => updateWorkout(session => {
    const exercisesCopy = [...session.exercises]; exercisesCopy[session.exerciseIndex] = { ...exercisesCopy[session.exerciseIndex], skipped: true };
    return { ...session, exercises: exercisesCopy, exerciseIndex: session.exerciseIndex + 1, setIndex: 0, restSeconds: null, restActive: false };
  });
  const replaceExercise = (exerciseId: string) => updateWorkout((session, current) => {
    const exercisesCopy = [...session.exercises]; exercisesCopy[session.exerciseIndex] = makeSessionExercise(exerciseId, current.history, session.units, session.exerciseIndex);
    return { ...session, exercises: exercisesCopy, setIndex: 0, restSeconds: null, restActive: false };
  });
  const addExercise = (exerciseId: string) => updateWorkout((session, current) => {
    if (session.exercises.some(item => item.exerciseId === exerciseId)) return session;
    return { ...session, exercises: [...session.exercises, makeSessionExercise(exerciseId, current.history, session.units, session.exercises.length)] };
  });
  const togglePause = () => updateWorkout(session => ({ ...session, paused: !session.paused }));
  const tickWorkout = () => updateWorkout(session => session.paused ? session : ({ ...session, elapsedSeconds: session.elapsedSeconds + 1,
    restSeconds: session.restActive ? Math.max(0, (session.restSeconds ?? 0) - 1) : session.restSeconds,
    restActive: session.restActive && (session.restSeconds ?? 0) > 1 }));

  const finishWorkout = () => {
    const current = repository.getSnapshot(); const session = current.activeWorkout;
    if (!session) return null;
    const workout = repository.getWorkoutTemplates().find(item => item.id === session.workoutId) ?? workoutById(session.workoutId);
    const completedExercises = session.exercises.filter(ex => ex.sets.some(set => set.completed));
    const volume = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(set => set.completed).reduce((total, set) => total + set.weight * set.reps, 0), 0);
    const personalRecords = completedExercises.flatMap(ex => {
      const prior = current.history.flatMap(item => item.exercises.filter(entry => entry.exerciseId === ex.exerciseId).flatMap(entry => entry.sets.map(set => ({ ...set, weight: convertWeight(set.weight, item.units ?? 'kg', session.units) })))).filter(set => set.completed !== false && set.weight > 0);
      const previousWeight = prior.reduce((best, set) => Math.max(best, set.weight), 0);
      const previousRepsAtBest = prior.filter(set => set.weight === previousWeight).reduce((best, set) => Math.max(best, set.reps), 0);
      const bestSet = ex.sets.filter(set => set.completed && set.weight > 0).reduce<typeof ex.sets[number] | null>((best, set) => !best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best, null);
      return bestSet && (bestSet.weight > previousWeight || (bestSet.weight === previousWeight && bestSet.reps > previousRepsAtBest)) ? [{ exerciseId: ex.exerciseId, weight: bestSet.weight, reps: bestSet.reps }] : [];
    });
    const item: WorkoutHistoryItem = { id: session.id, workoutId: session.workoutId, name: session.workoutName || workout.name,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), completedAt: Date.now(),
      duration: Math.max(1, Math.round(session.elapsedSeconds / 60)), volume: Math.round(volume), units: session.units,
      personalRecord: personalRecords.length > 0, personalRecords,
      exercises: session.exercises.map(ex => ({ id: ex.id, position: ex.position, exerciseId: ex.exerciseId, skipped: ex.skipped, sets: ex.sets.filter(set => set.completed) })) };
    const today = (new Date().getDay() + 6) % 7;
    const days = current.plan.map(day => day.weekday === today && day.workoutId === session.workoutId ? { ...day, status: 'done' as const } : day);
    repository.completeWorkoutSession(item, { ...repository.getActivePlan(), days });
    persistPlan(repository.getActivePlan());
    return item;
  };
  const discardWorkout = () => repository.discardWorkoutSession();
  const logBodyWeight = (weight: number) => {
    if (!Number.isFinite(weight) || weight <= 0) return;
    const current = repository.getSnapshot();
    const entry: BodyWeightEntry = { id: createId(), recordedAt: Date.now(), weight, units: current.units };
    repository.addBodyweightEntry(entry);
  };

  const regeneratePlan = (preferences: PlanPreferences, name?: string) => {
    const current = repository.getProfile();
    saveProfile({ ...current, name: name?.trim().slice(0, 40) || current.name, goal: preferences.goal, experience: preferences.experience, frequency: preferences.frequency, equipment: preferences.equipment, duration: preferences.duration, trainingFocus: preferences.focus });
    updatePlan(createPlan(preferences));
  };
  const startPlanWorkoutAction = (dayIndex: number) => startPlanWorkout(dayIndex);
  const replacePlanExercise = (dayIndex: number, exerciseIndex: number, exerciseId: string) => {
    const day = repository.getActivePlan().days[dayIndex]; const planned = day ? plannedExercises(day) : [];
    const selected = planned[exerciseIndex]; if (!day?.workoutId || !selected) return;
    const next = planned.map(item => item.id === selected.id ? { ...item, exerciseId } : item);
    const focus = [...new Set(next.flatMap(item => exerciseById(item.exerciseId).primaryMuscles))].join(', ');
    if (repository.replacePlanExercise(day.id, selected.id, exerciseId, { focus, duration: estimateWorkoutDuration(next) })) persistPlan(repository.getActivePlan());
  };
  const addPlanExercise = (dayIndex: number, exerciseId: string) => {
    const day = repository.getActivePlan().days[dayIndex]; if (!day?.workoutId) return;
    const current = plannedExercises(day); if (current.some(item => item.exerciseId === exerciseId)) return;
    const exercise = exerciseById(exerciseId);
    const next = [...current, { exerciseId, sets: exercise.sets, repRange: exercise.repRange, restSeconds: exercise.restSeconds }];
    const focus = [...new Set(next.flatMap(item => exerciseById(item.exerciseId).primaryMuscles))].join(', ');
    if (repository.addPlanExercise(day.id, { exerciseId, sets: exercise.sets, repRange: exercise.repRange, restSeconds: exercise.restSeconds }, { focus, duration: estimateWorkoutDuration(next) })) persistPlan(repository.getActivePlan());
  };
  const removePlanExercise = (dayIndex: number, exerciseIndex: number) => {
    const day = repository.getActivePlan().days[dayIndex]; const current = day ? plannedExercises(day) : [];
    if (!day?.workoutId || current.length <= 1 || !current[exerciseIndex]) return false;
    const next = current.filter((_, index) => index !== exerciseIndex);
    const focus = [...new Set(next.flatMap(item => exerciseById(item.exerciseId).primaryMuscles))].join(', ');
    const removed = repository.removePlanExercise(day.id, current[exerciseIndex].id, { focus, duration: estimateWorkoutDuration(next) });
    if (removed) persistPlan(repository.getActivePlan());
    return removed;
  };

  const addFood = (entry: Omit<FoodEntry, 'id' | 'date'>) => {
    const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    repository.addNutritionEntry({ ...entry, id: createId(), date });
  };
  const removeFood = (id: string) => repository.removeNutritionEntry(id);
  const appendCoachMessage = (message: Omit<CoachMessage, 'id' | 'timestamp'>) => repository.appendCoachMessage({ ...message, id: createId(), timestamp: Date.now() });
  const clearCoachMessages = () => repository.clearCoachConversation(createId());
  const updateName = (name: string) => saveProfile({ ...repository.getProfile(), name: name.trim().slice(0, 40) || repository.getProfile().name });
  const updateWorkoutSettings = (settings: Partial<WorkoutSettings>) => saveSettings({ ...repository.getSettings(), workoutSettings: { ...repository.getSettings().workoutSettings, ...settings } });
  const clearWorkoutHistory = () => repository.clearWorkoutHistory();
  const clearNutritionData = () => repository.clearNutritionEntries();
  const resetPlan = () => updatePlan(createPlan(createPlanPreferences(repository.getProfile())));
  const resetAppData = () => {
    const fresh = createInitialState();
    repository.resetAllData({ profile: createProfile(fresh), settings: { units: fresh.units, workoutSettings: fresh.workoutSettings }, plan: createPlan(createPlanPreferences(createProfile(fresh)), fresh.plan), coachConversationId: fresh.coachConversationId });
    saveSettings({ units: fresh.units, workoutSettings: fresh.workoutSettings });
    persistPlan(repository.getActivePlan());
  };

  const value = useMemo(() => ({ state, finishOnboarding, saveProfile, setUnits, toggleFavorite, startWorkout, startPlanWorkout: startPlanWorkoutAction, startSingleExercise,
    updateSet, completeSet, setRest, advanceWorkout, skipExercise, replaceExercise, addExercise, replacePlanExercise, addPlanExercise, removePlanExercise,
    togglePause, tickWorkout, finishWorkout, discardWorkout, logBodyWeight, regeneratePlan, addFood, removeFood, appendCoachMessage, clearCoachMessages,
    updateName, updateWorkoutSettings, clearWorkoutHistory, clearNutritionData, resetPlan, resetAppData }), [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSteadiifit() { const value = useContext(Context); if (!value) throw new Error('useSteadiifit must be used within AppProvider'); return value; }
