import React, { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { exerciseById, makePlan, PlanDay, workoutById } from '@/data/catalog';

export type Goal = 'Build muscle' | 'Get stronger' | 'Lose fat' | 'Stay consistent';
export type WorkoutSet = { weight: number; reps: number; completed: boolean; completedAt?: number };
export type SessionExercise = { exerciseId: string; targetSets: number; targetReps: string; repUnit: 'reps' | 'sec' | 'min'; skipped: boolean; sets: WorkoutSet[] };
export type ActiveWorkoutSession = {
  id: string; workoutId: string; workoutName: string; startedAt: number; elapsedSeconds: number; paused: boolean;
  exercises: SessionExercise[]; exerciseIndex: number; setIndex: number; restSeconds: number | null; restActive: boolean;
};
export type WorkoutHistoryItem = { id: string; workoutId: string; name: string; date: string; completedAt?: number; duration: number; volume: number; personalRecord: boolean; exercises: { exerciseId: string; skipped?: boolean; sets: { weight: number; reps: number; completed?: boolean }[] }[] };
export type SteadiifitState = {
  name: string; goal: Goal; experience: string; equipment: string; frequency: number; units: 'kg' | 'lb';
  plan: PlanDay[]; history: WorkoutHistoryItem[]; streak: number; activeWorkout: ActiveWorkoutSession | null; favoriteExerciseIds: string[];
};

const initialState: SteadiifitState = {
  name: 'Alex', goal: 'Build muscle', experience: 'Some Experience', equipment: 'Full Gym', frequency: 4, units: 'kg',
  plan: makePlan(4), streak: 6, activeWorkout: null, favoriteExerciseIds: [],
  history: [
    { id: 'h1', workoutId: 'pull', name: 'Back + Biceps', date: 'Sep 22', completedAt: Date.now() - 86400000, duration: 48, volume: 4820, personalRecord: true, exercises: [{ exerciseId: 'pulldown', sets: [{ weight: 45, reps: 10, completed: true }] }, { exerciseId: 'row', sets: [{ weight: 50, reps: 8, completed: true }] }] },
    { id: 'h2', workoutId: 'push', name: 'Chest + Triceps', date: 'Sep 20', completedAt: Date.now() - 3 * 86400000, duration: 44, volume: 3960, personalRecord: false, exercises: [{ exerciseId: 'bench', sets: [{ weight: 60, reps: 8, completed: true }] }] },
  ],
};

type Onboarding = Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency'>;
type ContextValue = {
  state: SteadiifitState; finishOnboarding: (value: Onboarding) => void; setUnits: (units: 'kg' | 'lb') => void; toggleFavorite: (exerciseId: string) => void;
  startWorkout: (workoutId: string) => void; updateSet: (weight: number, reps: number) => void; completeSet: () => void;
  startSingleExercise: (exerciseId: string) => void;
  setRest: (seconds: number | null, active?: boolean) => void; advanceWorkout: () => void; skipExercise: () => void;
  replaceExercise: (exerciseId: string) => void; addExercise: (exerciseId: string) => void; togglePause: () => void;
  tickWorkout: () => void; finishWorkout: () => WorkoutHistoryItem | null; discardWorkout: () => void;
};
const Context = createContext<ContextValue | null>(null);

const makeSessionExercise = (exerciseId: string, history: WorkoutHistoryItem[]): SessionExercise => {
  const exercise = exerciseById(exerciseId);
  const parsedReps = exercise.repRange.split(/[–-]/).pop()?.trim() || '10';
  const reps = Number(parsedReps.match(/\d+/)?.[0]) || 10;
  const repUnit = /min/i.test(parsedReps) ? 'min' : /sec/i.test(parsedReps) ? 'sec' : 'reps';
  const priorSets = history.flatMap(item => item.exercises).find(item => item.exerciseId === exerciseId)?.sets.filter(set => set.completed !== false) ?? [];
  return { exerciseId, targetSets: exercise.sets, targetReps: exercise.repRange, repUnit, skipped: false,
    sets: Array.from({ length: exercise.sets }, (_, index) => { const previousSet = priorSets[index] ?? priorSets[priorSets.length - 1]; return { weight: previousSet?.weight ?? (exercise.equipment === 'Bodyweight' ? 0 : 20), reps: previousSet?.reps ?? reps - (index > 0 ? 1 : 0), completed: false }; }) };
};

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initialState);
  const finishOnboarding = (value: Onboarding) => setState(previous => ({ ...previous, ...value, plan: makePlan(value.frequency) }));
  const setUnits = (units: 'kg' | 'lb') => setState(previous => ({ ...previous, units }));
  const toggleFavorite = (exerciseId: string) => setState(previous => ({ ...previous, favoriteExerciseIds: previous.favoriteExerciseIds.includes(exerciseId) ? previous.favoriteExerciseIds.filter(id => id !== exerciseId) : [...previous.favoriteExerciseIds, exerciseId] }));
  const startWorkout = (workoutId: string) => setState(previous => {
    if (previous.activeWorkout?.workoutId === workoutId) return previous;
    const workout = workoutById(workoutId);
    return { ...previous, activeWorkout: { id: `session-${Date.now()}`, workoutId, workoutName: workout.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, exercises: workout.exerciseIds.map(id => makeSessionExercise(id, previous.history)), exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const startSingleExercise = (exerciseId: string) => setState(previous => {
    const workoutId = `exercise-${exerciseId}`;
    if (previous.activeWorkout) return previous;
    const exercise = exerciseById(exerciseId);
    return { ...previous, activeWorkout: { id: `session-${Date.now()}`, workoutId, workoutName: exercise.name, startedAt: Date.now(), elapsedSeconds: 0, paused: false, exercises: [makeSessionExercise(exerciseId, previous.history)], exerciseIndex: 0, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const updateSet = (weight: number, reps: number) => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const exercisesCopy = [...session.exercises]; const ex = { ...exercisesCopy[session.exerciseIndex], sets: [...exercisesCopy[session.exerciseIndex].sets] };
    ex.sets[session.setIndex] = { ...ex.sets[session.setIndex], weight: Math.max(0, weight), reps: Math.max(1, reps) }; exercisesCopy[session.exerciseIndex] = ex;
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy } };
  });
  const completeSet = () => setState(previous => {
    const session = previous.activeWorkout; if (!session) return previous;
    const exercisesCopy = [...session.exercises]; const ex = { ...exercisesCopy[session.exerciseIndex], sets: [...exercisesCopy[session.exerciseIndex].sets] };
    ex.sets[session.setIndex] = { ...ex.sets[session.setIndex], completed: true, completedAt: Date.now() }; exercisesCopy[session.exerciseIndex] = ex;
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy, restSeconds: 90, restActive: true } };
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
    const exercisesCopy = [...session.exercises]; exercisesCopy[session.exerciseIndex] = makeSessionExercise(exerciseId, previous.history);
    return { ...previous, activeWorkout: { ...session, exercises: exercisesCopy, setIndex: 0, restSeconds: null, restActive: false } };
  });
  const addExercise = (exerciseId: string) => setState(previous => {
    const session = previous.activeWorkout; if (!session || session.exercises.some(item => item.exerciseId === exerciseId)) return previous;
    const exercisesCopy = [...session.exercises, makeSessionExercise(exerciseId, previous.history)];
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
      const prs = completedExercises.some(ex => {
        const previousBest = previous.history.flatMap(item => item.exercises).filter(item => item.exerciseId === ex.exerciseId).flatMap(item => item.sets).filter(set => set.completed !== false).reduce((best, set) => Math.max(best, set.weight), 0);
        return previousBest > 0 && ex.sets.some(set => set.completed && set.weight > previousBest);
      });
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      created = { id: session.id, workoutId: session.workoutId, name: session.workoutName || workout.name, date, completedAt: Date.now(), duration: Math.max(1, Math.round(session.elapsedSeconds / 60)), volume: Math.round(volume), personalRecord: prs, exercises: session.exercises.map(ex => ({ exerciseId: ex.exerciseId, skipped: ex.skipped, sets: ex.sets.filter(set => set.completed).map(({ weight, reps, completed }) => ({ weight, reps, completed })) })) };
      const today = (new Date().getDay() + 6) % 7; const plan = previous.plan.map(day => day.day === today && day.workoutId === session.workoutId ? { ...day, status: 'done' as const } : day);
      return { ...previous, plan, activeWorkout: null, history: [created!, ...previous.history] };
    });
    return created;
  };
  const discardWorkout = () => setState(previous => ({ ...previous, activeWorkout: null }));
  const value = useMemo(() => ({ state, finishOnboarding, setUnits, toggleFavorite, startWorkout, startSingleExercise, updateSet, completeSet, setRest, advanceWorkout, skipExercise, replaceExercise, addExercise, togglePause, tickWorkout, finishWorkout, discardWorkout }), [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSteadiifit() { const value = useContext(Context); if (!value) throw new Error('useSteadiifit must be used within AppProvider'); return value; }
