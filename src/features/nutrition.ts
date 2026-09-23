import type { BodyWeightEntry, FoodEntry, Goal } from '@/state/AppContext';

export type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number; meals: number };
export type NutritionTargets = { calories: number; protein: number; carbs: number; fat: number; estimated: true };

export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function nutritionTotals(entries: FoodEntry[], date = localDateKey()): NutritionTotals {
  return entries.filter(entry => entry.date === date).reduce((totals, entry) => ({
    calories: totals.calories + entry.calories, protein: totals.protein + entry.protein,
    carbs: totals.carbs + entry.carbs, fat: totals.fat + entry.fat, meals: totals.meals + 1,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
}

// A transparent, rough estimate from a user-entered weight and existing goal/schedule.
// This is a frontend estimate, not individualized medical or dietetic advice.
export function estimateNutritionTargets(weights: BodyWeightEntry[], goal: Goal, frequency: number): NutritionTargets | null {
  const latest = [...weights].sort((a, b) => b.recordedAt - a.recordedAt)[0];
  if (!latest || !Number.isFinite(latest.weight) || latest.weight <= 0) return null;
  const kg = latest.units === 'lb' ? latest.weight / 2.2046226218 : latest.weight;
  const activityFactor = 30 + Math.min(6, Math.max(0, frequency)) * 0.5;
  const calories = Math.round(Math.max(1200, kg * activityFactor + (goal === 'Build muscle' || goal === 'Get stronger' ? 200 : goal === 'Lose fat' ? -300 : 0)) / 50) * 50;
  const protein = Math.round(kg * (goal === 'Lose fat' ? 1.8 : 1.6));
  const fat = Math.round(kg * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, estimated: true };
}

