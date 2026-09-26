import type { BodyWeightEntry } from '@/types/domain';
import type { WeightUnit } from '@/features/units';
import { convertWeight } from '@/features/units';
import { supabase } from '@/lib/supabase';

type BodyweightEntryRow = {
  id: string;
  user_id: string;
  recorded_at: string;
  weight: number | string;
  units: string;
};

export type BodyweightRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export interface BodyweightRepository {
  listCurrentEntries(): Promise<BodyweightRepositoryResult<BodyWeightEntry[]>>;
  addCurrentEntry(entry: BodyWeightEntry): Promise<BodyweightRepositoryResult<null>>;
  deleteAllCurrentEntries(): Promise<BodyweightRepositoryResult<null>>;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user is available for bodyweight access.');
  return data.user.id;
}

function sourceUnit(value: string): WeightUnit {
  return value === 'lb' ? 'lb' : 'kg';
}

function mapEntry(row: BodyweightEntryRow): BodyWeightEntry {
  return {
    id: row.id,
    recordedAt: Date.parse(row.recorded_at) || Date.now(),
    weight: Number(convertWeight(Number(row.weight), sourceUnit(row.units), 'kg').toFixed(2)),
    units: 'kg',
  };
}

function entryFields(entry: BodyWeightEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    recorded_at: new Date(entry.recordedAt).toISOString(),
    weight: Number(convertWeight(entry.weight, entry.units, 'kg').toFixed(2)),
    units: 'kg',
  };
}

export const bodyweightRepository: BodyweightRepository = {
  async listCurrentEntries() {
    try {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from('bodyweight_entries')
        .select('id, user_id, recorded_at, weight, units')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return { data: (data ?? []).map(row => mapEntry(row as BodyweightEntryRow)), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async addCurrentEntry(entry) {
    try {
      const userId = await currentUserId();
      const { error } = await supabase.from('bodyweight_entries').insert(entryFields(entry, userId));
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteAllCurrentEntries() {
    try {
      const userId = await currentUserId();
      const { error } = await supabase.from('bodyweight_entries').delete().eq('user_id', userId);
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
