import type { BodyWeightEntry, WorkoutHistoryItem } from '@/state/AppContext';

export type CompletedSet = { weight: number; reps: number; completed?: boolean };
export type ProgressPoint = { date: number; weight: number; reps: number; volume: number };
export type ExerciseProgress = { exerciseId: string; sessions: number; bestWeight: number; bestReps: number; totalVolume: number; lastPerformed: number; points: ProgressPoint[] };
export type PersonalRecord = { exerciseId: string; weight: number; reps: number; date: number; workoutId: string };

export const workoutTimestamp = (workout: WorkoutHistoryItem, now = new Date()): number => {
  if (typeof workout.completedAt === 'number' && Number.isFinite(workout.completedAt)) return workout.completedAt;
  const parsed = Date.parse(`${workout.date} ${now.getFullYear()}`);
  return Number.isFinite(parsed) ? parsed : 0;
};
export const completedSets = (workout: WorkoutHistoryItem) => workout.exercises.flatMap(exercise => exercise.sets.filter(set => set.completed !== false));
export const workoutVolume = (workout: WorkoutHistoryItem) => {
  const fromSets = completedSets(workout).reduce((sum, set) => sum + safe(set.weight) * safe(set.reps), 0);
  return fromSets > 0 ? fromSets : safe(workout.volume);
};
const safe = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
const convertWeight = (value: number, from: 'kg' | 'lb', to: 'kg' | 'lb') => from === to ? value : from === 'kg' ? value * 2.2046226218 : value / 2.2046226218;
export const sortWorkoutsNewest = (history: WorkoutHistoryItem[], now = new Date()) => [...history].sort((a, b) => workoutTimestamp(b, now) - workoutTimestamp(a, now));
export const startOfWeek = (date: Date) => { const result = new Date(date); result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; };
export const calculateWeeklyWorkoutCount = (history: WorkoutHistoryItem[], now = new Date()) => { const start = startOfWeek(now).getTime(); return history.filter(item => workoutTimestamp(item, now) >= start && workoutTimestamp(item, now) <= now.getTime()).length; };
export const calculateMonthlyWorkoutCount = (history: WorkoutHistoryItem[], now = new Date()) => { const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); return history.filter(item => workoutTimestamp(item, now) >= start && workoutTimestamp(item, now) <= now.getTime()).length; };
export const calculateTotalWorkouts = (history: WorkoutHistoryItem[]) => history.length;
export const calculateTotalVolume = (history: WorkoutHistoryItem[], units: 'kg' | 'lb' = 'kg') => history.reduce((sum, item) => sum + convertWeight(workoutVolume(item), item.units ?? 'kg', units), 0);
export const calculateWorkoutStreak = (history: WorkoutHistoryItem[], now = new Date()) => {
  const days = new Set(history.map(item => { const date = new Date(workoutTimestamp(item, now)); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }));
  const cursor = new Date(now); cursor.setHours(0, 0, 0, 0);
  const today = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) { count += 1; cursor.setDate(cursor.getDate() - 1); }
  return count;
};
export const calculateWorkoutStats = (workout: WorkoutHistoryItem, units: 'kg' | 'lb' = workout.units ?? 'kg') => {
  const performed = workout.exercises.filter(item => item.sets.some(set => set.completed !== false));
  const sets = completedSets(workout);
  return { exerciseCount: performed.length, completedSets: sets.length, volume: convertWeight(workoutVolume(workout), workout.units ?? 'kg', units) };
};
export const calculatePersonalRecords = (history: WorkoutHistoryItem[], now = new Date(), units: 'kg' | 'lb' = 'kg'): PersonalRecord[] => {
  const best = new Map<string, PersonalRecord>();
  for (const workout of history) for (const exercise of workout.exercises) for (const set of exercise.sets) {
    const weight = convertWeight(safe(set.weight), workout.units ?? 'kg', units); const reps = safe(set.reps);
    if (set.completed === false || weight <= 0) continue;
    const candidate = { exerciseId: exercise.exerciseId, weight, reps, date: workoutTimestamp(workout, now), workoutId: workout.id };
    const current = best.get(exercise.exerciseId);
    if (!current || weight > current.weight || (weight === current.weight && reps > current.reps) || (weight === current.weight && reps === current.reps && candidate.date > current.date)) best.set(exercise.exerciseId, candidate);
  }
  return [...best.values()].sort((a, b) => b.date - a.date);
};
export const calculateExerciseProgress = (history: WorkoutHistoryItem[], exerciseId: string, now = new Date(), units: 'kg' | 'lb' = 'kg'): ExerciseProgress | null => {
  const points: ProgressPoint[] = [];
  for (const workout of history) {
    const entry = workout.exercises.find(exercise => exercise.exerciseId === exerciseId);
    if (!entry) continue;
    const sets = entry.sets.filter(set => set.completed !== false && safe(set.weight) >= 0 && safe(set.reps) > 0);
    if (!sets.length) continue;
    points.push({ date: workoutTimestamp(workout, now), weight: Math.max(...sets.map(set => convertWeight(safe(set.weight), workout.units ?? 'kg', units))), reps: Math.max(...sets.map(set => safe(set.reps))), volume: sets.reduce((sum, set) => sum + convertWeight(safe(set.weight), workout.units ?? 'kg', units) * safe(set.reps), 0) });
  }
  points.sort((a, b) => a.date - b.date);
  if (!points.length) return null;
  const records = calculatePersonalRecords(history, now, units).filter(record => record.exerciseId === exerciseId);
  const record = records[0];
  const bestPoint = points.reduce((best, point) => point.weight > best.weight || (point.weight === best.weight && point.reps > best.reps) ? point : best, points[0]);
  return { exerciseId, sessions: points.length, bestWeight: record?.weight ?? bestPoint.weight, bestReps: record?.reps ?? bestPoint.reps, totalVolume: points.reduce((sum, point) => sum + point.volume, 0), lastPerformed: points[points.length - 1].date, points };
};
export const sortedBodyWeight = (entries: BodyWeightEntry[]) => [...entries].sort((a, b) => b.recordedAt - a.recordedAt);
export const bodyWeightChange = (entries: BodyWeightEntry[]) => { const sorted = sortedBodyWeight(entries); if (sorted.length < 2) return null; const latest = sorted[0]; const prior = sorted[1]; const toKg = (entry: BodyWeightEntry) => entry.units === 'lb' ? entry.weight / 2.2046226218 : entry.weight; const deltaKg = toKg(latest) - toKg(prior); return latest.units === 'lb' ? deltaKg * 2.2046226218 : deltaKg; };
