import type { FoodMeal, NutritionEntry } from '@/types/domain';
import { supabase } from '@/lib/supabase';

type NutritionEntryRow = {
  id: string;
  user_id: string;
  date: string;
  meal: FoodMeal;
  name: string;
  calories: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  quantity: number | string | null;
  serving_unit: string | null;
};

export type NutritionRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export interface NutritionRepository {
  listCurrentEntries(expectedUserId: string): Promise<NutritionRepositoryResult<NutritionEntry[]>>;
  addCurrentEntry(entry: NutritionEntry, expectedUserId: string): Promise<NutritionRepositoryResult<null>>;
  updateCurrentEntry(entry: NutritionEntry, expectedUserId: string): Promise<NutritionRepositoryResult<null>>;
  removeCurrentEntry(id: string, expectedUserId: string): Promise<NutritionRepositoryResult<null>>;
  clearCurrentEntries(expectedUserId: string): Promise<NutritionRepositoryResult<null>>;
}

async function currentUserId(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== expectedUserId) throw new Error('The authenticated user changed before the nutrition operation could run.');
  return data.user.id;
}

function mapEntry(row: NutritionEntryRow): NutritionEntry {
  return {
    id: row.id,
    // PostgreSQL DATE is returned as YYYY-MM-DD; keep it as a date-only string.
    date: row.date,
    meal: row.meal,
    name: row.name,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    ...(row.quantity === null ? {} : { quantity: Number(row.quantity) }),
    ...(row.serving_unit === null ? {} : { servingUnit: row.serving_unit }),
  };
}

function entryFields(entry: NutritionEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    meal: entry.meal,
    name: entry.name,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    quantity: entry.quantity ?? null,
    serving_unit: entry.servingUnit ?? null,
  };
}

export const nutritionRepository: NutritionRepository = {
  async listCurrentEntries(expectedUserId) {
    try {
      const userId = await currentUserId(expectedUserId);
      const { data, error } = await supabase
        .from('nutrition_entries')
        .select('id, user_id, date, meal, name, calories, protein, carbs, fat, quantity, serving_unit')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data ?? []).map(row => mapEntry(row as NutritionEntryRow)), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async addCurrentEntry(entry, expectedUserId) {
    try {
      const userId = await currentUserId(expectedUserId);
      const { error } = await supabase.from('nutrition_entries').insert(entryFields(entry, userId));
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateCurrentEntry(entry, expectedUserId) {
    try {
      const userId = await currentUserId(expectedUserId);
      const fields = entryFields(entry, userId);
      const { id: _id, user_id: _userId, date: _date, ...updates } = fields;
      const { error } = await supabase.from('nutrition_entries').update(updates).eq('id', entry.id).eq('user_id', userId);
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async removeCurrentEntry(id, expectedUserId) {
    try {
      const userId = await currentUserId(expectedUserId);
      const { error } = await supabase.from('nutrition_entries').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async clearCurrentEntries(expectedUserId) {
    try {
      const userId = await currentUserId(expectedUserId);
      const { error } = await supabase.from('nutrition_entries').delete().eq('user_id', userId);
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
