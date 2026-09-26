import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import type { ProfilePersonalDetails } from '@/data/repositories/profile';
import { settingsRepository } from '@/data/repositories/settings';
import { planRepository } from '@/data/repositories/plan';
import { workoutRepository } from '@/data/repositories/workout';
import { bodyweightRepository } from '@/data/repositories/bodyweight';
import { nutritionRepository } from '@/data/repositories/nutrition';
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

type Onboarding = Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency'> & {
  dateOfBirth: string; heightCm: number; currentWeight: number; units: WeightUnit;
};
type ContextValue = {
  state: SteadiifitState; profileLoaded: boolean; onboardingCompleted: boolean;
  personalInformation: { dateOfBirth: string | null; heightCm: number | null };
  savePersonalInformation: (value: { name: string; dateOfBirth: string | null; heightCm: number | null; units: WeightUnit; weight: number | null }) => void;
  finishOnboarding: (value: Onboarding) => void; saveProfile: (profile: Profile) => void; setUnits: (units: 'kg' | 'lb') => void; toggleFavorite: (exerciseId: string) => void;
  startWorkout: (workoutId: string) => void; updateSet: (weight: number, reps: number) => void; completeSet: () => void;
  startSingleExercise: (exerciseId: string) => void;
  setRest: (seconds: number | null, active?: boolean) => void; advanceWorkout: () => void; skipExercise: () => void;
  replaceExercise: (exerciseId: string) => void; addExercise: (exerciseId: string) => void; togglePause: () => void;
  tickWorkout: () => void; finishWorkout: () => WorkoutHistoryItem | null; discardWorkout: () => void; logBodyWeight: (weight: number) => void;
  regeneratePlan: (preferences: PlanPreferences, name?: string) => void; startPlanWorkout: (dayIndex: number) => string | null;
  replacePlanExercise: (dayIndex: number, exerciseIndex: number, exerciseId: string) => void; addPlanExercise: (dayIndex: number, exerciseId: string) => void; removePlanExercise: (dayIndex: number, exerciseIndex: number) => boolean;
  addFood: (entry: Omit<FoodEntry, 'id' | 'date'>) => void; updateFood: (entry: FoodEntry) => void; removeFood: (id: string) => void; appendCoachMessage: (message: Omit<CoachMessage, 'id' | 'timestamp'>) => void; clearCoachMessages: () => void;
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [personalInformation, setPersonalInformation] = useState<{ dateOfBirth: string | null; heightCm: number | null }>({ dateOfBirth: null, heightCm: null });
  const initialProfileRef = useRef(repository.getProfile());
  const profileInitializationRef = useRef<Promise<void> | null>(null);
  const initialSettingsRef = useRef(repository.getSettings());
  const settingsInitializationRef = useRef<Promise<void> | null>(null);
  const initialPlanRef = useRef(repository.getActivePlan());
  const planInitializationRef = useRef<Promise<void> | null>(null);
  const planWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workoutInitializationRef = useRef<Promise<void> | null>(null);
  const workoutWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const bodyweightInitializationRef = useRef<Promise<void> | null>(null);
  const bodyweightWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const nutritionInitializationRef = useRef<Promise<void> | null>(null);
  const nutritionWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const nutritionLoadedUserIdRef = useRef<string | null>(null);
  const nutritionRemovedBeforeLoadRef = useRef(new Set<string>());
  const nutritionClearedBeforeLoadRef = useRef(false);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) {
      setProfileLoaded(false);
      setOnboardingCompleted(false);
      return;
    }
    let active = true;
    setProfileLoaded(false);
    const initialProfile = initialProfileRef.current;
    profileInitializationRef.current = (async () => {
      try {
        const result = await profileRepository.getOrCreateCurrentProfile(initialProfile);
        if (result.error || !result.data) {
          if (result.error) console.error('Could not load the profile onboarding status; keeping the local profile for this session.', result.error);
          return;
        }
        const current = repository.getProfile();
        if (Object.keys(initialProfile).every(key => current[key as keyof Profile] === initialProfile[key as keyof Profile])) {
          repository.updateProfile(result.data.profile);
        }
        if (active) setOnboardingCompleted(result.data.onboardingCompleted);
        if (active) setPersonalInformation({ dateOfBirth: result.data.dateOfBirth, heightCm: result.data.heightCm });
      } finally {
        if (active) setProfileLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [authStatus, repository, user]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    workoutInitializationRef.current = (async () => {
      const result = await workoutRepository.loadCurrentWorkouts();
      if (result.error || !result.data) {
        if (result.error) console.error('Could not load workouts from Supabase; keeping local workout data for this session.', result.error);
        return;
      }
      const localActiveSession = repository.getSnapshot().activeWorkout;
      const existingIds = new Set(repository.getWorkoutHistory().map(item => item.id));
      for (const item of result.data.history.slice().reverse()) {
        if (!existingIds.has(item.id)) repository.completeWorkoutSession(item);
      }
      if (localActiveSession) repository.createWorkoutSession(localActiveSession);
      else if (result.data.activeSession) repository.createWorkoutSession(result.data.activeSession);
    })();
  }, [authStatus, repository, user]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    bodyweightInitializationRef.current = (async () => {
      const result = await bodyweightRepository.listCurrentEntries();
      if (result.error || !result.data) {
        if (result.error) console.error('Could not load bodyweight entries from Supabase; keeping local entries for this session.', result.error);
        return;
      }
      const existingIds = new Set(repository.getBodyweightEntries().map(entry => entry.id));
      for (const entry of result.data.slice().reverse()) {
        if (!existingIds.has(entry.id)) repository.addBodyweightEntry(entry);
      }
    })();
  }, [authStatus, repository, user]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    let active = true;
    if (nutritionLoadedUserIdRef.current && nutritionLoadedUserIdRef.current !== user.id) repository.clearNutritionEntries();
    nutritionLoadedUserIdRef.current = null;
    nutritionRemovedBeforeLoadRef.current.clear();
    nutritionClearedBeforeLoadRef.current = false;
    nutritionInitializationRef.current = (async () => {
      try {
        const result = await nutritionRepository.listCurrentEntries(user.id);
        if (!active) return;
        if (result.error || !result.data) {
          if (result.error) console.error('Could not load nutrition entries from Supabase; keeping local entries for this session.', result.error);
          return;
        }
        const existingIds = new Set(repository.getSnapshot().foodEntries.map(entry => entry.id));
        for (const entry of result.data.slice().reverse()) {
          if (!nutritionClearedBeforeLoadRef.current && !nutritionRemovedBeforeLoadRef.current.has(entry.id) && !existingIds.has(entry.id)) {
            repository.addNutritionEntry(entry);
          }
        }
      } finally {
        if (active) {
          nutritionLoadedUserIdRef.current = user.id;
          nutritionRemovedBeforeLoadRef.current.clear();
          nutritionClearedBeforeLoadRef.current = false;
        }
      }
    })();
    return () => { active = false; };
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

  const saveProfile = (profile: Profile, personalDetails?: ProfilePersonalDetails) => {
    repository.updateProfile(profile);
    void (async () => {
      await profileInitializationRef.current;
      const result = await profileRepository.updateCurrentProfile(profile, personalDetails);
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

  const queueWorkoutWrite = (write: () => Promise<{ error: unknown | null }>) => {
    const save = async () => {
      await workoutInitializationRef.current;
      const result = await write();
      if (result.error) console.error('Could not save workout data to Supabase; keeping local workout data for this session.', result.error);
    };
    workoutWriteQueueRef.current = workoutWriteQueueRef.current.then(save, save);
  };

  const persistActiveWorkout = (session: WorkoutSession) => queueWorkoutWrite(async () => {
    const result = await workoutRepository.saveActiveSession(session);
    return { error: result.error };
  });

  const persistCompletedWorkout = (session: WorkoutSession, history: WorkoutHistoryItem) => queueWorkoutWrite(async () => {
    const result = await workoutRepository.completeSession(session, history);
    return { error: result.error };
  });

  const deletePersistedWorkout = (id: string) => queueWorkoutWrite(async () => {
    const result = await workoutRepository.discardSession(id);
    return { error: result.error };
  });

  const clearPersistedWorkoutHistory = () => queueWorkoutWrite(async () => {
    const result = await workoutRepository.clearCompletedSessions();
    return { error: result.error };
  });

  const persistBodyweightEntry = (entry: BodyWeightEntry) => {
    const save = async () => {
      await bodyweightInitializationRef.current;
      const result = await bodyweightRepository.addCurrentEntry(entry);
      if (result.error) console.error('Could not save the bodyweight entry to Supabase; keeping it locally for this session.', result.error);
    };
    bodyweightWriteQueueRef.current = bodyweightWriteQueueRef.current.then(save, save);
  };

  const clearPersistedBodyweightEntries = () => {
    const clear = async () => {
      await bodyweightInitializationRef.current;
      const result = await bodyweightRepository.deleteAllCurrentEntries();
      if (result.error) console.error('Could not clear bodyweight entries in Supabase; keeping local reset behavior for this session.', result.error);
    };
    bodyweightWriteQueueRef.current = bodyweightWriteQueueRef.current.then(clear, clear);
  };

  const persistNutritionEntry = (entry: NutritionEntry) => {
    const save = async () => {
      await nutritionInitializationRef.current;
      const ownerId = user?.id;
      if (!ownerId) return;
      const result = await nutritionRepository.addCurrentEntry(entry, ownerId);
      if (result.error) console.error('Could not save the nutrition entry to Supabase; keeping it locally for this session.', result.error);
    };
    nutritionWriteQueueRef.current = nutritionWriteQueueRef.current.then(save, save);
  };

  const persistNutritionRemoval = (id: string) => {
    if (nutritionLoadedUserIdRef.current !== user?.id) nutritionRemovedBeforeLoadRef.current.add(id);
    const remove = async () => {
      await nutritionInitializationRef.current;
      const ownerId = user?.id;
      if (!ownerId) return;
      const result = await nutritionRepository.removeCurrentEntry(id, ownerId);
      if (result.error) console.error('Could not remove the nutrition entry from Supabase; keeping the local change for this session.', result.error);
    };
    nutritionWriteQueueRef.current = nutritionWriteQueueRef.current.then(remove, remove);
  };

  const persistNutritionUpdate = (entry: NutritionEntry) => {
    const update = async () => {
      await nutritionInitializationRef.current;
      const ownerId = user?.id;
      if (!ownerId) return;
      const result = await nutritionRepository.updateCurrentEntry(entry, ownerId);
      if (result.error) console.error('Could not update the nutrition entry in Supabase; keeping the local change for this session.', result.error);
    };
    nutritionWriteQueueRef.current = nutritionWriteQueueRef.current.then(update, update);
  };

  const clearPersistedNutritionEntries = () => {
    if (nutritionLoadedUserIdRef.current !== user?.id) nutritionClearedBeforeLoadRef.current = true;
    const clear = async () => {
      await nutritionInitializationRef.current;
      const ownerId = user?.id;
      if (!ownerId) return;
      const result = await nutritionRepository.clearCurrentEntries(ownerId);
      if (result.error) console.error('Could not clear nutrition entries in Supabase; keeping the local change for this session.', result.error);
    };
    nutritionWriteQueueRef.current = nutritionWriteQueueRef.current.then(clear, clear);
  };

  const finishOnboarding = (value: Onboarding) => {
    const { dateOfBirth, heightCm, currentWeight, units, ...profileValues } = value;
    const profile = { ...repository.getProfile(), ...profileValues };
    setOnboardingCompleted(true);
    setPersonalInformation({ dateOfBirth, heightCm });
    setUnits(units);
    saveProfile(profile, { dateOfBirth, heightCm });
    logBodyWeight(currentWeight);
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
    persistActiveWorkout(repository.getSnapshot().activeWorkout!);
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
    persistActiveWorkout(repository.getSnapshot().activeWorkout!);
    return workoutId;
  };
  const startSingleExercise = (exerciseId: string) => {
    const current = repository.getSnapshot(); if (current.activeWorkout) return;
    const exercise = repository.getExercises().find(item => item.id === exerciseId) ?? exerciseById(exerciseId);
    repository.createWorkoutSession({ id: createId(), workoutId: `exercise-${exerciseId}`, workoutName: exercise.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: current.units,
      exercises: [makeSessionExercise(exerciseId, current.history, current.units, 0)], exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false });
    persistActiveWorkout(repository.getSnapshot().activeWorkout!);
  };
  const updateWorkout = (transform: (session: WorkoutSession, current: SteadiifitSnapshot) => WorkoutSession, shouldPersist = true) => {
    const current = repository.getSnapshot(); const session = current.activeWorkout;
    if (session) {
      const updated = transform(session, current);
      repository.updateWorkoutSession(updated);
      if (shouldPersist && updated !== session) persistActiveWorkout(updated);
    }
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
  const tickWorkout = () => {
    const session = repository.getSnapshot().activeWorkout;
    if (!session || session.paused) return;
    const nextElapsed = session.elapsedSeconds + 1;
    const restFinishing = session.restActive && (session.restSeconds ?? 0) <= 1;
    updateWorkout(current => ({ ...current, elapsedSeconds: nextElapsed,
      restSeconds: current.restActive ? Math.max(0, (current.restSeconds ?? 0) - 1) : current.restSeconds,
      restActive: current.restActive && (current.restSeconds ?? 0) > 1 }), nextElapsed % 5 === 0 || restFinishing);
  };

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
    persistCompletedWorkout(session, item);
    return item;
  };
  const discardWorkout = () => {
    const active = repository.getSnapshot().activeWorkout;
    if (!active) return;
    repository.discardWorkoutSession();
    deletePersistedWorkout(active.id);
  };
  const logBodyWeight = (weight: number) => {
    if (!Number.isFinite(weight) || weight <= 0) return;
    const current = repository.getSnapshot();
    const entry: BodyWeightEntry = { id: createId(), recordedAt: Date.now(), weight: Number(convertWeight(weight, current.units, 'kg').toFixed(2)), units: 'kg' };
    repository.addBodyweightEntry(entry);
    persistBodyweightEntry(entry);
  };

  const savePersonalInformation = (value: { name: string; dateOfBirth: string | null; heightCm: number | null; units: WeightUnit; weight: number | null }) => {
    const currentProfile = repository.getProfile();
    const nextProfile = { ...currentProfile, name: value.name.trim().slice(0, 40) || currentProfile.name };
    setPersonalInformation({ dateOfBirth: value.dateOfBirth, heightCm: value.heightCm });
    setUnits(value.units);
    saveProfile(nextProfile, { dateOfBirth: value.dateOfBirth, heightCm: value.heightCm });
    if (value.weight !== null) logBodyWeight(value.weight);
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
    const nutritionEntry = { ...entry, id: createId(), date };
    repository.addNutritionEntry(nutritionEntry);
    persistNutritionEntry(nutritionEntry);
  };
  const removeFood = (id: string) => {
    repository.removeNutritionEntry(id);
    persistNutritionRemoval(id);
  };
  const updateFood = (entry: FoodEntry) => {
    repository.updateNutritionEntry(entry);
    persistNutritionUpdate(entry);
  };
  const appendCoachMessage = (message: Omit<CoachMessage, 'id' | 'timestamp'>) => repository.appendCoachMessage({ ...message, id: createId(), timestamp: Date.now() });
  const clearCoachMessages = () => repository.clearCoachConversation(createId());
  const updateName = (name: string) => saveProfile({ ...repository.getProfile(), name: name.trim().slice(0, 40) || repository.getProfile().name });
  const updateWorkoutSettings = (settings: Partial<WorkoutSettings>) => saveSettings({ ...repository.getSettings(), workoutSettings: { ...repository.getSettings().workoutSettings, ...settings } });
  const clearWorkoutHistory = () => {
    repository.clearWorkoutHistory();
    clearPersistedWorkoutHistory();
  };
  const clearNutritionData = () => {
    repository.clearNutritionEntries();
    clearPersistedNutritionEntries();
  };
  const resetPlan = () => updatePlan(createPlan(createPlanPreferences(repository.getProfile())));
  const resetAppData = () => {
    const fresh = createInitialState();
    const activeWorkoutId = repository.getSnapshot().activeWorkout?.id;
    repository.resetAllData({ profile: createProfile(fresh), settings: { units: fresh.units, workoutSettings: fresh.workoutSettings }, plan: createPlan(createPlanPreferences(createProfile(fresh)), fresh.plan), coachConversationId: fresh.coachConversationId });
    saveSettings({ units: fresh.units, workoutSettings: fresh.workoutSettings });
    persistPlan(repository.getActivePlan());
    if (activeWorkoutId) deletePersistedWorkout(activeWorkoutId);
    clearPersistedWorkoutHistory();
    clearPersistedBodyweightEntries();
    clearPersistedNutritionEntries();
  };

  const value = useMemo(() => ({ state, profileLoaded, onboardingCompleted, personalInformation, savePersonalInformation, finishOnboarding, saveProfile, setUnits, toggleFavorite, startWorkout, startPlanWorkout: startPlanWorkoutAction, startSingleExercise,
    updateSet, completeSet, setRest, advanceWorkout, skipExercise, replaceExercise, addExercise, replacePlanExercise, addPlanExercise, removePlanExercise,
    togglePause, tickWorkout, finishWorkout, discardWorkout, logBodyWeight, regeneratePlan, addFood, updateFood, removeFood, appendCoachMessage, clearCoachMessages,
    updateName, updateWorkoutSettings, clearWorkoutHistory, clearNutritionData, resetPlan, resetAppData }), [state, profileLoaded, onboardingCompleted, personalInformation]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSteadiifit() { const value = useContext(Context); if (!value) throw new Error('useSteadiifit must be used within AppProvider'); return value; }
