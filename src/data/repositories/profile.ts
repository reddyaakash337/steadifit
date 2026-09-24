import type { Goal, Profile, TrainingFocus } from '@/types/domain';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  display_name: string | null;
  goal: string | null;
  training_focus: string | null;
  equipment: string[];
  training_days_per_week: number | null;
  workout_duration_minutes: number | null;
};

export type ProfileRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export interface ProfileRepository {
  getOrCreateCurrentProfile(defaults: Profile): Promise<ProfileRepositoryResult<Profile>>;
  updateCurrentProfile(profile: Profile): Promise<ProfileRepositoryResult<Profile>>;
}

const asGoal = (value: string | null, fallback: Goal): Goal =>
  value === 'Build muscle' || value === 'Get stronger' || value === 'Lose fat' || value === 'Stay consistent' ? value : fallback;

const asFocus = (value: string | null, fallback: TrainingFocus): TrainingFocus =>
  value === 'Balanced' || value === 'Full Body' || value === 'Upper Body' || value === 'Lower Body' || value === 'Push' || value === 'Pull' || value === 'Legs' || value === 'Strength' || value === 'Hypertrophy' ? value : fallback;

function mapProfile(row: ProfileRow, fallback: Profile): Profile {
  return {
    name: row.display_name?.trim() || fallback.name,
    goal: asGoal(row.goal, fallback.goal),
    experience: fallback.experience,
    equipment: row.equipment?.[0] || fallback.equipment,
    frequency: row.training_days_per_week ?? fallback.frequency,
    duration: row.workout_duration_minutes ?? fallback.duration,
    trainingFocus: asFocus(row.training_focus, fallback.trainingFocus),
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user is available for profile access.');
  return data.user.id;
}

function profileFields(profile: Profile, onboardingCompleted = true) {
  return {
    display_name: profile.name,
    goal: profile.goal,
    training_focus: profile.trainingFocus,
    equipment: [profile.equipment],
    training_days_per_week: profile.frequency,
    workout_duration_minutes: profile.duration,
    onboarding_completed: onboardingCompleted,
    updated_at: new Date().toISOString(),
  };
}

export const profileRepository: ProfileRepository = {
  async getOrCreateCurrentProfile(defaults: Profile): Promise<ProfileRepositoryResult<Profile>> {
    try {
      const id = await currentUserId();
      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw readError;
      if (existing) return { data: mapProfile(existing as ProfileRow, defaults), error: null };

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .upsert({ id, ...profileFields(defaults, false) }, { onConflict: 'id', ignoreDuplicates: true })
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes')
        .maybeSingle();
      if (insertError) throw insertError;
      if (inserted) return { data: mapProfile(inserted as ProfileRow, defaults), error: null };

      // Another session may have created the row between our read and insert.
      const { data: createdByAnotherSession, error: rereadError } = await supabase
        .from('profiles')
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes')
        .eq('id', id)
        .single();
      if (rereadError) throw rereadError;
      return { data: mapProfile(createdByAnotherSession as ProfileRow, defaults), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateCurrentProfile(profile: Profile): Promise<ProfileRepositoryResult<Profile>> {
    try {
      const id = await currentUserId();
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id, ...profileFields(profile) }, { onConflict: 'id' })
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes')
        .single();
      if (error) throw error;
      return { data: mapProfile(data as ProfileRow, profile), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
