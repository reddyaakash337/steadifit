import React, { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { exerciseById, PlanDay, PlannedExercise, workoutById } from '@/data/catalog';
import { estimateWorkoutDuration, generateWorkoutPlan, PlanPreferences, plannedExercises, TrainingFocus } from '@/features/plan';
import { convertWeight } from '@/features/units';
import type { WeightUnit } from '@/features/units';

export type Goal = 'Build muscle' | 'Get stronger' | 'Lose fat' | 'Stay consistent';
export type WorkoutSet = { weight: number; reps: number; completed: boolean; completedAt?: number };
export type SessionExercise = { exerciseId: string; targetSets: number; targetReps: string; repUnit: 'reps' | 'sec' | 'min'; restSeconds?: number; skipped: boolean; sets: WorkoutSet[] };
export type ActiveWorkoutSession = {
  id: string; workoutId: string; workoutName: string; startedAt: number; elapsedSeconds: number; paused: boolean; units: WeightUnit;
  exercises: SessionExercise[]; exerciseIndex: number; setIndex: number; restSeconds: number | null; restActive: boolean;
};
export type WorkoutHistoryItem = { id: string; workoutId: string; name: string; date: string; completedAt?: number; duration: number; volume: number; units?: 'kg' | 'lb'; personalRecord: boolean; personalRecords?: { exerciseId: string; weight: number; reps: number }[]; exercises: { exerciseId: string; skipped?: boolean; sets: { weight: number; reps: number; completed?: boolean }[] }[] };
export type BodyWeightEntry = { id: string; recordedAt: number; weight: number; units: 'kg' | 'lb' };
export type FoodMeal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type FoodEntry = { id: string; date: string; meal: FoodMeal; name: string; calories: number; protein: number; carbs: number; fat: number };
export type CoachMessage = { id: string; role: 'user' | 'assistant'; text: string; timestamp: number };
export type WorkoutSettings = { defaultRestSeconds: number; autoStartRest: boolean };
export type SteadiifitState = {
  name: string; goal: Goal; experience: string; equipment: string; frequency: number; units: 'kg' | 'lb'; duration: number; trainingFocus: TrainingFocus; planStartedAt: number;
  plan: PlanDay[]; history: WorkoutHistoryItem[]; bodyWeightEntries: BodyWeightEntry[]; foodEntries: FoodEntry[]; coachMessages: CoachMessage[]; activeWorkout: ActiveWorkoutSession | null; favoriteExerciseIds: string[]; workoutSettings: WorkoutSettings;
};

const createInitialState = (): SteadiifitState => ({
  name: 'Alex', goal: 'Build muscle', experience: 'Some Experience', equipment: 'Full Gym', frequency: 4, units: 'kg', duration: 45, trainingFocus: 'Balanced', planStartedAt: Date.now(),
  plan: generateWorkoutPlan({ goal: 'Build muscle', experience: 'Some Experience', frequency: 4, equipment: 'Full Gym', duration: 45, focus: 'Balanced' }), activeWorkout: null, favoriteExerciseIds: [], bodyWeightEntries: [], workoutSettings: { defaultRestSeconds: 90, autoStartRest: true },
  history: [], foodEntries: [], coachMessages: [],
});

type Onboarding = Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency'>;
type ContextValue = {
  state: SteadiifitState; finishOnboarding: (value: Onboarding) => void; setUnits: (units: 'kg' | 'lb') => void; toggleFavorite: (exerciseId: string) => void;
  startWorkout: (workoutId: string) => void; updateSet: (weight: number, reps: number) => void; completeSet: () => void;
  startSingleExercise: (exerciseId: string) => void;
  setRest: (seconds: number | null, active?: boolean) => void; advanceWorkout: () => void; skipExercise: () => void;
  replaceExercise: (exerciseId: string) => void; addExercise: (exerciseId: string) => void; togglePause: () => void;
  tickWorkout: () => void; finishWorkout: () => WorkoutHistoryItem | null; discardWorkout: () => void; logBodyWeight: (weight: number) => void;
  regeneratePlan: (preferences: PlanPreferences) => void; startPlanWorkout: (dayIndex: number) => string | null;
  replacePlanExercise: (dayIndex: number, exerciseIndex: number, exerciseId: string) => void; addPlanExercise: (dayIndex: number, exerciseId: string) => void; removePlanExercise: (dayIndex: number, exerciseIndex: number) => boolean;
  addFood: (entry: Omit<FoodEntry, 'id' | 'date'>) => void; removeFood: (id: string) => void; appendCoachMessage: (message: Omit<CoachMessage, 'id' | 'timestamp'>) => void; clearCoachMessages: () => void;
  updateName: (name: string) => void; updateWorkoutSettings: (settings: Partial<WorkoutSettings>) => void;
  clearWorkoutHistory: () => void; clearNutritionData: () => void; resetPlan: () => void; resetAppData: () => void;
};
const Context = createContext<ContextValue | null>(null);

const makeSessionExercise = (exerciseId: string, history: WorkoutHistoryItem[], units: WeightUnit, prescription?: PlannedExercise): SessionExercise => {
  const exercise = exerciseById(exerciseId);
  const targetSets = prescription?.sets ?? exercise.sets; const targetReps = prescription?.repRange ?? exercise.repRange;
  const parsedReps = targetReps.split(/[–-]/).pop()?.trim() || '10';
  const reps = Number(parsedReps.match(/\d+/)?.[0]) || 10;
  const repUnit = /min/i.test(parsedReps) ? 'min' : /sec/i.test(parsedReps) ? 'sec' : 'reps';
  const priorWorkout = history.find(item => item.exercises.some(entry => entry.exerciseId === exerciseId));
  const priorSets = priorWorkout?.exercises.find(item => item.exerciseId === exerciseId)?.sets.filter(set => set.completed !== false).map(set => ({ ...set, weight: convertWeight(set.weight, priorWorkout.units ?? 'kg', units) })) ?? [];
  return { exerciseId, targetSets, targetReps, repUnit, restSeconds: prescription?.restSeconds ?? exercise.restSeconds, skipped: false,
    sets: Array.from({ length: targetSets }, (_, index) => { const previousSet = priorSets[index] ?? priorSets[priorSets.length - 1]; return { weight: previousSet?.weight ?? (exercise.equipment === 'Bodyweight' ? 0 : 20), reps: previousSet?.reps ?? reps - (index > 0 ? 1 : 0), completed: false }; }) };
};

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createInitialState);
  const finishOnboarding = (value: Onboarding) => setState(previous => {
    const merged = { ...previous, ...value };
    return { ...merged, planStartedAt: Date.now(), plan: generateWorkoutPlan({ goal: merged.goal, experience: merged.experience, frequency: merged.frequency, equipment: merged.equipment, duration: merged.duration, focus: merged.trainingFocus }) };
  });
  const setUnits = (units: 'kg' | 'lb') => setState(previous => ({ ...previous, units }));
  const toggleFavorite = (exerciseId: string) => setState(previous => ({ ...previous, favoriteExerciseIds: previous.favoriteExerciseIds.includes(exerciseId) ? previous.favoriteExerciseIds.filter(id => id !== exerciseId) : [...previous.favoriteExerciseIds, exerciseId] }));
  const startWorkout = (workoutId: string) => setState(previous => {
    if (previous.activeWorkout?.workoutId === workoutId) return previous;
    const workout = workoutById(workoutId);
    return { ...previous, activeWorkout: { id: `session-${Date.now()}`, workoutId, workoutName: workout.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: previous.units, exercises: workout.exerciseIds.map(id => makeSessionExercise(id, previous.history, previous.units)), exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const startPlanWorkout = (dayIndex: number) => {
    const selectedDay = state.plan[dayIndex];
    if (!selectedDay?.workoutId) return null;
    const workoutId = selectedDay.workoutId;
    setState(previous => {
      if (previous.activeWorkout) return previous;
      const day = previous.plan[dayIndex]; if (!day?.workoutId) return previous;
      const template = workoutById(day.workoutId); const planned = plannedExercises(day);
      return { ...previous, activeWorkout: { id: `session-${Date.now()}`, workoutId: day.workoutId, workoutName: day.title ?? template.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: previous.units, exercises: planned.map(item => makeSessionExercise(item.exerciseId, previous.history, previous.units, item)), exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false } };
    });
    return workoutId;
  };
  const startSingleExercise = (exerciseId: string) => setState(previous => {
    const workoutId = `exercise-${exerciseId}`;
    if (previous.activeWorkout) return previous;
    const exercise = exerciseById(exerciseId);
    return { ...previous, activeWorkout: { id: `session-${Date.now()}`, workoutId, workoutName: exercise.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, units: previous.units, exercises: [makeSessionExercise(exerciseId, previous.history, previous.units)], exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const updateSet = (weight: number, reps: number) => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const exercisesCopy = [...session.exercises]; const ex = { ...exercisesCopy[session.exerciseIndex], sets: [...exercisesCopy[session.exerciseIndex].sets] };
    ex.sets[session.setIndex] = { ...ex.sets[session.setIndex], weight: Math.max(0, convertWeight(weight, previous.units, session.units)), reps: Math.max(1, reps) }; exercisesCopy[session.exerciseIndex] = ex;
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy } };
  });
  const completeSet = () => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const exercisesCopy = [...session.exercises]; const ex = { ...exercisesCopy[session.exerciseIndex], sets: [...exercisesCopy[session.exerciseIndex].sets] };
    ex.sets[session.setIndex] = { ...ex.sets[session.setIndex], completed: true, completedAt: Date.now() }; exercisesCopy[session.exerciseIndex] = ex;
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy, restSeconds: previous.workoutSettings.defaultRestSeconds, restActive: previous.workoutSettings.autoStartRest } };
  });
  const setRest = (seconds: number | null, active = false) => setState(previous => previous.activeWorkout ? { ...previous, activeWorkout: { ...previous.activeWorkout, restSeconds: seconds, restActive: active } } : previous);
  const advanceWorkout = () => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const ex = session.exercises[session.exerciseIndex];
    if (session.setIndex + 1 < ex.sets.length) return { ...previous, activeWorkout: { ...session, setIndex: session.setIndex + 1, restSeconds: null, restActive: false } };
    if (session.exerciseIndex + 1 < session.exercises.length) return { ...previous, activeWorkout: { ...session, exerciseIndex: session.exerciseIndex + 1, setIndex: 0, restSeconds: null, restActive: false } };
    return previous;
  });
  const skipExercise = () => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const exercisesCopy = [...session.exercises]; exercisesCopy[session.exerciseIndex] = { ...exercisesCopy[session.exerciseIndex], skipped: true };
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy, exerciseIndex: session.exerciseIndex + 1, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const replaceExercise = (exerciseId: string) => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const exercisesCopy = [...session.exercises]; exercisesCopy[session.exerciseIndex] = makeSessionExercise(exerciseId, previous.history, session.units);
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const addExercise = (exerciseId: string) => setState(previous => {
    const session = previous.activeWorkout; if (!session || session.exercises.some(item => item.exerciseId === exerciseId)) return previous;
    const exercisesCopy = [...session.exercises, makeSessionExercise(exerciseId, previous.history, session.units)];
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy } };
  });
  const togglePause = () => setState(previous => previous.activeWorkout ? { ...previous, activeWorkout: { ...previous.activeWorkout, paused: !previous.activeWorkout.paused } } : previous);
  const tickWorkout = () => setState(previous => previous.activeWorkout && !previous.activeWorkout.paused ? { ...previous, activeWorkout: { ...previous.activeWorkout, elapsedSeconds: previous.activeWorkout.elapsedSeconds + 1, restSeconds: previous.activeWorkout.restActive ? Math.max(0, (previous.activeWorkout.restSeconds ?? 0) - 1) : previous.activeWorkout.restSeconds, restActive: previous.activeWorkout.restActive && (previous.activeWorkout.restSeconds ?? 0) > 1 } } : previous);
  const finishWorkout = () => {
    let created: WorkoutHistoryItem | null = null;
    setState(previous => {
      const session = previous.activeWorkout; if (!session) return previous;
      const workout = workoutById(session.workoutId);
      const completedExercises = session.exercises.filter(ex => ex.sets.some(set => set.completed));
      const volume = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(set => set.completed).reduce((total, set) => total + set.weight * set.reps, 0), 0);
      const personalRecords = completedExercises.flatMap(ex => {
        const prior = previous.history.flatMap(item => item.exercises.filter(entry => entry.exerciseId === ex.exerciseId).flatMap(entry => entry.sets.map(set => ({ ...set, weight: convertWeight(set.weight, item.units ?? 'kg', session.units) })))).filter(set => set.completed !== false && set.weight > 0);
        const previousWeight = prior.reduce((best, set) => Math.max(best, set.weight), 0);
        const previousRepsAtBest = prior.filter(set => set.weight === previousWeight).reduce((best, set) => Math.max(best, set.reps), 0);
        const bestSet = ex.sets.filter(set => set.completed && set.weight > 0).reduce<typeof ex.sets[number] | null>((best, set) => !best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best, null);
        return bestSet && (bestSet.weight > previousWeight || (bestSet.weight === previousWeight && bestSet.reps > previousRepsAtBest)) ? [{ exerciseId: ex.exerciseId, weight: bestSet.weight, reps: bestSet.reps }] : [];
      });
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      created = { id: session.id, workoutId: session.workoutId, name: session.workoutName || workout.name, date, completedAt: Date.now(), duration: Math.max(1, Math.round(session.elapsedSeconds / 60)), volume: Math.round(volume), units: session.units, personalRecord: personalRecords.length > 0, personalRecords, exercises: session.exercises.map(ex => ({ exerciseId: ex.exerciseId, skipped: ex.skipped, sets: ex.sets.filter(set => set.completed).map(({ weight, reps, completed }) => ({ weight, reps, completed })) })) };
      const today = (new Date().getDay() + 6) % 7; const plan = previous.plan.map(day => day.day === today && day.workoutId === session.workoutId ? { ...day, status: 'done' as const } : day);
      return { ...previous, plan, activeWorkout: null, history: [created!, ...previous.history] };
    });
    return created;
  };
  const discardWorkout = () => setState(previous => ({ ...previous, activeWorkout: null }));
  const logBodyWeight = (weight: number) => {
    if (!Number.isFinite(weight) || weight <= 0) return;
    const recordedAt = Date.now();
    setState(previous => ({ ...previous, bodyWeightEntries: [{ id: `weight-${recordedAt}`, recordedAt, weight, units: previous.units }, ...previous.bodyWeightEntries] }));
  };
  const regeneratePlan = (preferences: PlanPreferences) => setState(previous => ({ ...previous, goal: preferences.goal, experience: preferences.experience, frequency: preferences.frequency, equipment: preferences.equipment, duration: preferences.duration, trainingFocus: preferences.focus, planStartedAt: Date.now(), plan: generateWorkoutPlan(preferences) }));
  const replacePlanExercise = (dayIndex: number, exerciseIndex: number, exerciseId: string) => setState(previous => {
    const day = previous.plan[dayIndex]; if (!day?.workoutId) return previous;
    const next = [...plannedExercises(day)]; if (!next[exerciseIndex]) return previous;
    next[exerciseIndex] = { ...next[exerciseIndex], exerciseId };
    const focus = [...new Set(next.flatMap(item => exerciseById(item.exerciseId).primaryMuscles))].join(', ');
    return { ...previous, plan: previous.plan.map((item, index) => index === dayIndex ? { ...item, exercises: next, focus, duration: estimateWorkoutDuration(next) } : item) };
  });
  const addPlanExercise = (dayIndex: number, exerciseId: string) => setState(previous => {
    const day = previous.plan[dayIndex]; if (!day?.workoutId) return previous;
    const next = plannedExercises(day); if (next.some(item => item.exerciseId === exerciseId)) return previous;
    const exercise = exerciseById(exerciseId); const appended = [...next, { exerciseId, sets: exercise.sets, repRange: exercise.repRange, restSeconds: exercise.restSeconds }];
    const focus = [...new Set(appended.flatMap(item => exerciseById(item.exerciseId).primaryMuscles))].join(', ');
    return { ...previous, plan: previous.plan.map((item, index) => index === dayIndex ? { ...item, exercises: appended, focus, duration: estimateWorkoutDuration(appended) } : item) };
  });
  const removePlanExercise = (dayIndex: number, exerciseIndex: number) => {
    const currentDay = state.plan[dayIndex]; const current = currentDay ? plannedExercises(currentDay) : [];
    if (!currentDay?.workoutId || current.length <= 1 || !current[exerciseIndex]) return false;
    setState(previous => ({ ...previous, plan: previous.plan.map((item, index) => { if (index !== dayIndex) return item; const next = plannedExercises(item).filter((_, exercise) => exercise !== exerciseIndex); const focus = [...new Set(next.flatMap(entry => exerciseById(entry.exerciseId).primaryMuscles))].join(', '); return { ...item, exercises: next, focus, duration: estimateWorkoutDuration(next) }; }) }));
    return true;
  };
  const addFood = (entry: Omit<FoodEntry, 'id' | 'date'>) => setState(previous => { const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; return { ...previous, foodEntries: [{ ...entry, id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date }, ...previous.foodEntries] }; });
  const removeFood = (id: string) => setState(previous => ({ ...previous, foodEntries: previous.foodEntries.filter(entry => entry.id !== id) }));
  const appendCoachMessage = (message: Omit<CoachMessage, 'id' | 'timestamp'>) => setState(previous => ({ ...previous, coachMessages: [...previous.coachMessages, { ...message, id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now() }] }));
  const clearCoachMessages = () => setState(previous => ({ ...previous, coachMessages: [] }));
  const updateName = (name: string) => setState(previous => ({ ...previous, name: name.trim().slice(0, 40) || previous.name }));
  const updateWorkoutSettings = (settings: Partial<WorkoutSettings>) => setState(previous => ({ ...previous, workoutSettings: { ...previous.workoutSettings, ...settings } }));
  const clearWorkoutHistory = () => setState(previous => ({ ...previous, history: [] }));
  const clearNutritionData = () => setState(previous => ({ ...previous, foodEntries: [] }));
  const resetPlan = () => setState(previous => { const preferences = { goal: previous.goal, experience: previous.experience, frequency: previous.frequency, equipment: previous.equipment, duration: previous.duration, focus: previous.trainingFocus }; return { ...previous, planStartedAt: Date.now(), plan: generateWorkoutPlan(preferences) }; });
  const resetAppData = () => setState(createInitialState());
  const value = useMemo(() => ({ state, finishOnboarding, setUnits, toggleFavorite, startWorkout, startPlanWorkout, startSingleExercise, updateSet, completeSet, setRest, advanceWorkout, skipExercise, replaceExercise, addExercise, replacePlanExercise, addPlanExercise, removePlanExercise, togglePause, tickWorkout, finishWorkout, discardWorkout, logBodyWeight, regeneratePlan, addFood, removeFood, appendCoachMessage, clearCoachMessages, updateName, updateWorkoutSettings, clearWorkoutHistory, clearNutritionData, resetPlan, resetAppData }), [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSteadiifit() { const value = useContext(Context); if (!value) throw new Error('useSteadiifit must be used within AppProvider'); return value; }
