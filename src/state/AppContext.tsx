import React, { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { makePlan, PlanDay } from '@/data/catalog';

export type Goal = 'Build muscle' | 'Get stronger' | 'Lose fat' | 'Stay consistent';
export type WorkoutHistoryItem = { id: string; workoutId: string; name: string; date: string; duration: number; volume: number; personalRecord: boolean; exercises: { exerciseId: string; sets: { weight: number; reps: number }[] }[] };
export type SteadiifitState = {
  name: string; goal: Goal; experience: string; equipment: string; frequency: number; units: 'kg' | 'lb';
  plan: PlanDay[]; history: WorkoutHistoryItem[]; streak: number;
};

const initialState: SteadiifitState = {
  name: 'Alex', goal: 'Build muscle', experience: 'Some Experience', equipment: 'Full Gym', frequency: 4, units: 'kg',
  plan: makePlan(4), streak: 6,
  history: [
    { id: 'h1', workoutId: 'pull', name: 'Back + Biceps', date: 'Sep 22', duration: 48, volume: 4820, personalRecord: true, exercises: [{ exerciseId: 'pulldown', sets: [{ weight: 45, reps: 10 }] }, { exerciseId: 'row', sets: [{ weight: 50, reps: 8 }] }] },
    { id: 'h2', workoutId: 'push', name: 'Chest + Triceps', date: 'Sep 20', duration: 44, volume: 3960, personalRecord: false, exercises: [{ exerciseId: 'bench', sets: [{ weight: 60, reps: 8 }] }] },
  ],
};

type ContextValue = { state: SteadiifitState; finishOnboarding: (value: Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency'>) => void; setUnits: (units: 'kg' | 'lb') => void };
const Context = createContext<ContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initialState);
  const finishOnboarding = (value: Pick<SteadiifitState, 'name' | 'goal' | 'experience' | 'equipment' | 'frequency'>) => setState(previous => ({ ...previous, ...value, plan: makePlan(value.frequency) }));
  const setUnits = (units: 'kg' | 'lb') => setState(previous => ({ ...previous, units }));
  const value = useMemo(() => ({ state, finishOnboarding, setUnits }), [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSteadiifit() {
  const value = useContext(Context);
  if (!value) throw new Error('useSteadiifit must be used within AppProvider');
  return value;
}
