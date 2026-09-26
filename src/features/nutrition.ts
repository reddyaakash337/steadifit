import type { BodyWeightEntry, Goal, NutritionEntry } from '@/types/domain';

export type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number; meals: number };
export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function nutritionTotals(entries: NutritionEntry[], date = localDateKey()): NutritionTotals {
  return entries.filter(entry => entry.date === date).reduce((totals, entry) => ({
    calories: totals.calories + entry.calories, protein: totals.protein + entry.protein,
    carbs: totals.carbs + entry.carbs, fat: totals.fat + entry.fat, meals: totals.meals + 1,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
}

export type FoodSuggestion = { entry: NutritionEntry; uses: number };

function foodKey(entry: NutritionEntry): string {
  return entry.name.trim().toLocaleLowerCase();
}

/** Entries are already newest-first within a date; date sorting keeps that stable order. */
export function recentFoods(entries: NutritionEntry[], limit = 5): FoodSuggestion[] {
  const ordered = entries.map((entry, index) => ({ entry, index }))
    .sort((left, right) => right.entry.date.localeCompare(left.entry.date) || left.index - right.index);
  const counts = new Map<string, number>();
  ordered.forEach(({ entry }) => {
    const key = foodKey(entry);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const seen = new Set<string>();
  const result: FoodSuggestion[] = [];
  for (const { entry } of ordered) {
    const key = foodKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ entry, uses: counts.get(key) ?? 1 });
    if (result.length >= limit) break;
  }
  return result;
}

export function frequentFoods(entries: NutritionEntry[], minimumHistory = 5, limit = 3): FoodSuggestion[] {
  if (entries.length < minimumHistory) return [];
  const recentByKey = new Map(recentFoods(entries, entries.length).map(item => [foodKey(item.entry), item.entry]));
  const counts = new Map<string, number>();
  entries.forEach(entry => {
    const key = foodKey(entry);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, uses]) => uses >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .flatMap(([key, uses]) => {
      const entry = recentByKey.get(key);
      return entry ? [{ entry, uses }] : [];
    });
}

/**
 * Compatibility for the existing Coach context. Coach does not receive height or
 * date of birth, so it cannot safely calculate a target. Nutrition UI uses the
 * complete-input service in nutritionTargets.ts.
 */
export type CoachNutritionTargets = { calories: number; protein: number; carbs: number; fat: number };
export function estimateNutritionTargets(
  _weights: BodyWeightEntry[],
  _goal: Goal,
  _frequency: number,
): CoachNutritionTargets | null {
  return null;
}
