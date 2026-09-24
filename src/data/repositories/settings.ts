import type { UserSettings } from '@/types/domain';
import { supabase } from '@/lib/supabase';

type UserSettingsRow = {
  user_id: string;
  unit_system: string;
  rest_timer_seconds: number;
  auto_start_rest_timer: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
};

export type SettingsRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export interface SettingsRepository {
  getOrCreateCurrentSettings(defaults: UserSettings): Promise<SettingsRepositoryResult<UserSettings>>;
  updateCurrentSettings(settings: UserSettings): Promise<SettingsRepositoryResult<UserSettings>>;
}

function mapSettings(row: UserSettingsRow): UserSettings {
  return {
    units: row.unit_system === 'imperial' ? 'lb' : 'kg',
    workoutSettings: {
      defaultRestSeconds: row.rest_timer_seconds,
      autoStartRest: row.auto_start_rest_timer,
      soundEnabled: row.sound_enabled,
      vibrationEnabled: row.vibration_enabled,
    },
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user is available for settings access.');
  return data.user.id;
}

function settingsFields(settings: UserSettings) {
  return {
    unit_system: settings.units === 'lb' ? 'imperial' : 'metric',
    rest_timer_seconds: settings.workoutSettings.defaultRestSeconds,
    auto_start_rest_timer: settings.workoutSettings.autoStartRest,
    sound_enabled: settings.workoutSettings.soundEnabled,
    vibration_enabled: settings.workoutSettings.vibrationEnabled,
    updated_at: new Date().toISOString(),
  };
}

export const settingsRepository: SettingsRepository = {
  async getOrCreateCurrentSettings(defaults) {
    try {
      const userId = await currentUserId();
      const { data: existing, error: readError } = await supabase
        .from('user_settings')
        .select('user_id, unit_system, rest_timer_seconds, auto_start_rest_timer, sound_enabled, vibration_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (readError) throw readError;
      if (existing) return { data: mapSettings(existing as UserSettingsRow), error: null };

      const { data: inserted, error: insertError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settingsFields(defaults),
        }, { onConflict: 'user_id', ignoreDuplicates: true })
        .select('user_id, unit_system, rest_timer_seconds, auto_start_rest_timer, sound_enabled, vibration_enabled')
        .maybeSingle();
      if (insertError) throw insertError;
      if (inserted) return { data: mapSettings(inserted as UserSettingsRow), error: null };

      // Another session may have inserted settings after the initial read.
      const { data: createdByAnotherSession, error: rereadError } = await supabase
        .from('user_settings')
        .select('user_id, unit_system, rest_timer_seconds, auto_start_rest_timer, sound_enabled, vibration_enabled')
        .eq('user_id', userId)
        .single();
      if (rereadError) throw rereadError;
      return { data: mapSettings(createdByAnotherSession as UserSettingsRow), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateCurrentSettings(settings) {
    try {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...settingsFields(settings) }, { onConflict: 'user_id' })
        .select('user_id, unit_system, rest_timer_seconds, auto_start_rest_timer, sound_enabled, vibration_enabled')
        .single();
      if (error) throw error;
      return { data: mapSettings(data as UserSettingsRow), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
