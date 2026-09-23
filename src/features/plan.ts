import { exercises, Exercise, PlanDay, PlannedExercise, workoutById, workouts } from '@/data/catalog';
import type { Goal, PlanPreferences, TrainingFocus, WorkoutHistoryItem } from '@/types/domain';
import { createId } from '@/utils/ids';
import { startOfWeek, workoutTimestamp } from '@/features/progress';

export type { PlanPreferences, TrainingFocus } from '@/types/domain';
export type PlanDayStatus = 'Rest' | 'Completed' | 'Today' | 'Upcoming' | 'Skipped';

const SCHEDULES: Record<number, (string | null)[]> = {
  2: ['Full Body', null, null, 'Full Body', null, null, null],
  3: ['Push', null, 'Pull', null, 'Legs', null, null],
  4: ['Upper Body', 'Lower Body', null, 'Upper Body', null, 'Lower Body', null],
  5: ['Push', 'Pull', 'Legs', null, 'Upper Body', 'Full Body', null],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', null],
};
const musclesBySplit: Record<string, string[]> = {
  'Full Body': ['Legs', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core'],
  'Upper Body': ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  'Lower Body': ['Legs', 'Glutes'], Push: ['Chest', 'Shoulders', 'Triceps'], Pull: ['Back', 'Biceps'], Legs: ['Legs', 'Glutes'],
};
const workoutForSplit: Record<string, string> = { 'Full Body': 'full', 'Upper Body': 'full', 'Lower Body': 'legs', Push: 'push', Pull: 'pull', Legs: 'legs' };
const frequencyValue = (value: number) => Math.min(6, Math.max(2, Math.round(Number.isFinite(value) ? value : 4)));
type PlannedPrescription = Omit<PlannedExercise, 'id' | 'position'>;
const fallbackPlanExerciseIds = new Map<string, string>();

export function equipmentCompatible(exercise: Exercise, selection: string) {
  if (selection === 'Full Gym' || selection === 'Full Gym + Machines') return true;
  if (selection === 'Dumbbells') return ['Dumbbell', 'Bodyweight'].includes(exercise.equipment);
  if (selection === 'Barbell') return ['Barbell', 'Bodyweight'].includes(exercise.equipment);
  if (selection === 'Machines') return ['Machine', 'Bodyweight'].includes(exercise.equipment);
  if (selection === 'Resistance Bands') return ['Resistance Band', 'Bodyweight'].includes(exercise.equipment);
  if (selection === 'Bodyweight') return exercise.equipment === 'Bodyweight';
  return exercise.equipment === 'Bodyweight';
}

const isCompound = (exercise: Exercise) => /bench|squat|deadlift|romanian|row|pulldown|pull-up|shoulder press|overhead press/i.test(exercise.name);
const targetExerciseCount = (duration: number) => duration <= 30 ? 3 : duration <= 45 ? 5 : duration <= 60 ? 6 : 7;
const prescriptionFor = (exercise: Exercise, goal: Goal, focus: TrainingFocus): PlannedPrescription => {
  const compound = isCompound(exercise);
  if (goal === 'Get stronger' || focus === 'Strength') return { exerciseId: exercise.id, sets: compound ? 4 : 3, repRange: compound ? '4–6' : '6–8', restSeconds: compound ? 150 : 120 };
  if (focus === 'Hypertrophy' || goal === 'Build muscle') return { exerciseId: exercise.id, sets: compound ? 4 : 3, repRange: compound ? '8–12' : '10–15', restSeconds: 90 };
  if (goal === 'Lose fat') return { exerciseId: exercise.id, sets: 3, repRange: compound ? '8–12' : '10–15', restSeconds: 60 };
  if (goal === 'Stay consistent') return { exerciseId: exercise.id, sets: 3, repRange: compound ? '8–12' : '10–15', restSeconds: 75 };
  return { exerciseId: exercise.id, sets: exercise.sets, repRange: exercise.repRange, restSeconds: exercise.restSeconds };
};

export function estimateWorkoutDuration(planExercises: PlannedPrescription[], catalog: Exercise[] = exercises) {
  if (!planExercises.length) return 0;
  const totalSeconds = planExercises.reduce((total, planned) => {
    const exercise = catalog.find(item => item.id === planned.exerciseId);
    const reps = planned.repRange.match(/\d+/g)?.map(Number) ?? [10];
    const midpoint = reps.length > 1 ? (reps[0] + reps[1]) / 2 : reps[0];
    const workSeconds = Math.min(60, Math.max(20, midpoint * 3));
    return total + planned.sets * (workSeconds + (planned.restSeconds || exercise?.restSeconds || 60));
  }, 120 + Math.max(0, planExercises.length - 1) * 45);
  return Math.ceil(totalSeconds / 60);
}

function chooseExercises(split: string, preferences: PlanPreferences, catalog: Exercise[]): PlannedPrescription[] {
  const targetMuscles = musclesBySplit[split] ?? musclesBySplit['Full Body'];
  const candidates = catalog.filter(exercise => equipmentCompatible(exercise, preferences.equipment) && exercise.category === 'Strength' && exercise.primaryMuscles.some(muscle => targetMuscles.includes(muscle)) && (preferences.experience !== 'New to training' || exercise.difficulty !== 'Advanced'));
  const sorted = candidates.slice().sort((a, b) => {
    const muscleOrder = targetMuscles.indexOf(a.muscle) - targetMuscles.indexOf(b.muscle);
    if (muscleOrder !== 0) return muscleOrder;
    const compoundPreference = Number(isCompound(b)) - Number(isCompound(a));
    return preferences.goal === 'Get stronger' || preferences.focus === 'Strength' ? compoundPreference : 0;
  });
  const count = targetExerciseCount(preferences.duration);
  const chosen: Exercise[] = [];
  // Round-robin the focus muscles so a workout does not stack all its exercises on one area.
  for (let pass = 0; chosen.length < count && pass < count; pass += 1) {
    for (const muscle of targetMuscles) {
      const next = sorted.find(item => item.muscle === muscle && !chosen.some(entry => entry.id === item.id));
      if (next) chosen.push(next);
      if (chosen.length >= count) break;
    }
  }
  // Sparse equipment/focus combinations fall back only to compatible catalog exercises.
  for (const next of sorted) if (chosen.length < count && !chosen.some(entry => entry.id === next.id)) chosen.push(next);
  const planned = chosen.map(exercise => prescriptionFor(exercise, preferences.goal, preferences.focus));
  const targetSeconds = Math.max(30, preferences.duration) * 60;
  while (planned.length > 2 && estimateWorkoutDuration(planned, catalog) > targetSeconds + 5 * 60) planned.pop();
  return planned;
}

export function generateWorkoutPlan(preferences: PlanPreferences, catalog: Exercise[] = exercises): PlanDay[] {
  const frequency = frequencyValue(preferences.frequency);
  const baseSchedule = SCHEDULES[frequency] ?? SCHEDULES[4];
  const schedule = baseSchedule.map(split => {
    if (!split || preferences.focus === 'Balanced' || preferences.focus === 'Strength' || preferences.focus === 'Hypertrophy') return split;
    return preferences.focus;
  });
  return schedule.map((split, weekday) => {
    if (!split) return { id: createId(), weekday, day: weekday, workoutId: null, status: 'upcoming', exercises: [] };
    const planned = chooseExercises(split, preferences, catalog).map((item, position) => ({ ...item, id: createId(), position }));
    const canonicalId = workoutForSplit[split] ?? 'full';
    const muscleGroups = [...new Set(planned.flatMap(item => catalog.find(exercise => exercise.id === item.exerciseId)?.primaryMuscles ?? []))];
    return { id: createId(), weekday, day: weekday, workoutId: canonicalId, status: 'upcoming', title: split, focus: muscleGroups.join(', '), duration: estimateWorkoutDuration(planned, catalog), exercises: planned };
  });
}

export function plannedExercises(day: PlanDay, catalog: Exercise[] = exercises): PlannedExercise[] {
  if (day.exercises) return day.exercises;
  const workout = workouts.find(item => item.id === day.workoutId);
  return (workout?.exerciseIds ?? []).map((exerciseId, position) => {
    const exercise = catalog.find(item => item.id === exerciseId);
    if (!exercise) return null;
    const cacheKey = `${day.id}:${exercise.id}`;
    let id = fallbackPlanExerciseIds.get(cacheKey);
    if (!id) { id = createId(); fallbackPlanExerciseIds.set(cacheKey, id); }
    return { id, exerciseId: exercise.id, position, sets: exercise.sets, repRange: exercise.repRange, restSeconds: exercise.restSeconds };
  }).filter((item): item is PlannedExercise => item !== null);
}
export function planDayName(day: PlanDay) { return day.title ?? (day.workoutId ? workoutById(day.workoutId).name : 'Rest and recover'); }
export function planDayFocus(day: PlanDay) { return day.focus ?? (day.workoutId ? workoutById(day.workoutId).focus : 'Recovery'); }
export function planDayDuration(day: PlanDay) { return day.duration ?? estimateWorkoutDuration(plannedExercises(day)); }
export function currentPlanWeek(startedAt: number, now = new Date()) {
  const origin = startOfWeek(new Date(startedAt)); const current = startOfWeek(now);
  return Math.max(1, Math.floor((current.getTime() - origin.getTime()) / (7 * 86400000)) + 1);
}
export function planDayStatus(day: PlanDay, history: WorkoutHistoryItem[], now = new Date()): PlanDayStatus {
  if (!day.workoutId) return 'Rest';
  const monday = startOfWeek(now); const target = new Date(monday); target.setDate(monday.getDate() + day.day); target.setHours(0, 0, 0, 0);
  const next = new Date(target); next.setDate(next.getDate() + 1);
  const completed = history.some(item => item.workoutId === day.workoutId && workoutTimestamp(item, now) >= target.getTime() && workoutTimestamp(item, now) < next.getTime());
  if (completed) return 'Completed';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (target.getTime() < today.getTime()) return 'Skipped';
  if (target.getTime() === today.getTime()) return 'Today';
  return 'Upcoming';
}
export function planWeekProgress(plan: PlanDay[], history: WorkoutHistoryItem[], now = new Date()) {
  const workouts = plan.filter(day => Boolean(day.workoutId));
  const completed = workouts.filter(day => planDayStatus(day, history, now) === 'Completed').length;
  return { completed, planned: workouts.length, ratio: workouts.length ? completed / workouts.length : 0 };
}
