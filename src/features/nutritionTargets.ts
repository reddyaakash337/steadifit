import type { BodyWeightEntry, Goal, TrainingFocus } from '@/types/domain';
import { convertWeight } from '@/features/units';

export type TargetRange = { min: number; max: number };
export type NutritionTargetValue = number | TargetRange;
export type NutritionTargets = {
  calories: TargetRange;
  protein: number;
  carbohydrates: TargetRange;
  fat: number;
  bmr: TargetRange;
  activityFactor: number;
  calorieAdjustment: number;
  proteinFactor: number;
  weeklyTrainingMinutes: number | null;
};
export type NutritionTargetInput = {
  dateOfBirth: string | null;
  heightCm: number | null;
  bodyWeightEntries: BodyWeightEntry[];
  goal: Goal;
  trainingFrequency: number;
  workoutDurationMinutes?: number | null;
  trainingFocus?: TrainingFocus | null;
  today?: Date;
};
export type NutritionTargetResult = {
  targets: NutritionTargets | null;
  missingInformation: string[];
};

function ageOnDate(dateOfBirth: string | null, today: Date): number | null {
  if (!dateOfBirth) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day || birthDate > today) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function latestWeightKg(entries: BodyWeightEntry[]): number | null {
  const latest = entries.filter(entry => Number.isFinite(entry.recordedAt) && Number.isFinite(entry.weight) && entry.weight > 0)
    .reduce<BodyWeightEntry | null>((best, entry) => !best || entry.recordedAt > best.recordedAt ? entry : best, null);
  if (!latest) return null;
  const kg = convertWeight(latest.weight, latest.units, 'kg');
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

function activityFactor(frequency: number, duration: number | null | undefined): { factor: number; weeklyMinutes: number | null } {
  const validFrequency = Number.isFinite(frequency) ? Math.max(0, frequency) : 0;
  if (duration === null || duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    return { factor: validFrequency === 0 ? 1.2 : validFrequency <= 3 ? 1.375 : validFrequency <= 5 ? 1.55 : 1.725, weeklyMinutes: null };
  }
  const weeklyMinutes = validFrequency * duration;
  // Conventional Mifflin activity multipliers, classified from planned weekly training time.
  const factor = weeklyMinutes === 0 ? 1.2 : weeklyMinutes < 150 ? 1.375 : weeklyMinutes < 300 ? 1.55 : 1.725;
  return { factor, weeklyMinutes };
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function orderedRange(first: number, second: number, step = 1): TargetRange {
  return { min: roundToNearest(Math.min(first, second), step), max: roundToNearest(Math.max(first, second), step) };
}

export function calculateNutritionTargets(input: NutritionTargetInput): NutritionTargetResult {
  const today = input.today ?? new Date();
  const age = ageOnDate(input.dateOfBirth, today);
  const height = input.heightCm;
  const weightKg = latestWeightKg(input.bodyWeightEntries);
  const missingInformation: string[] = [];
  if (age === null) missingInformation.push('date of birth');
  if (height === null || !Number.isFinite(height) || height < 50 || height > 280) missingInformation.push('height');
  if (weightKg === null) missingInformation.push('current weight');
  if (missingInformation.length || height === null || weightKg === null || age === null) {
    return { targets: null, missingInformation };
  }

  // Mifflin–St Jeor uses +5 for men and −161 for women. Since sex is not collected,
  // use both constants as an explicit estimate interval instead of assuming either.
  const sharedBmr = 10 * weightKg + 6.25 * height - 5 * age;
  const bmr = orderedRange(sharedBmr - 161, sharedBmr + 5);
  const activity = activityFactor(input.trainingFrequency, input.workoutDurationMinutes);
  const calorieAdjustment = input.goal === 'Lose fat' ? 0.85
    : input.goal === 'Build muscle' ? 1.08
      : input.goal === 'Get stronger' ? 1.05 : 1;
  const calories = orderedRange(bmr.min * activity.factor * calorieAdjustment, bmr.max * activity.factor * calorieAdjustment, 50);

  const focusNeedsHigherProtein = input.trainingFocus === 'Strength' || input.trainingFocus === 'Hypertrophy' ||
    input.trainingFocus === 'Push' || input.trainingFocus === 'Pull' || input.trainingFocus === 'Legs';
  const proteinFactor = input.goal === 'Lose fat' || input.goal === 'Build muscle' || input.goal === 'Get stronger' || focusNeedsHigherProtein ? 1.8 : 1.6;
  const protein = Math.round(weightKg * proteinFactor);
  const fat = Math.round(weightKg * 0.8);
  const carbohydrates = orderedRange(
    Math.max(0, (calories.min - protein * 4 - fat * 9) / 4),
    Math.max(0, (calories.max - protein * 4 - fat * 9) / 4),
  );

  return {
    targets: { calories, protein, carbohydrates, fat, bmr, activityFactor: activity.factor, calorieAdjustment, proteinFactor, weeklyTrainingMinutes: activity.weeklyMinutes },
    missingInformation: [],
  };
}

export function formatTarget(value: NutritionTargetValue, suffix = ''): string {
  const format = (amount: number) => `${Math.round(amount).toLocaleString()}${suffix}`;
  if (typeof value === 'number') return format(value);
  if (value.min === value.max) return format(value.min);
  return `${format(value.min)}–${format(value.max)}`;
}

export function targetMidpoint(value: NutritionTargetValue): number {
  return typeof value === 'number' ? value : (value.min + value.max) / 2;
}
