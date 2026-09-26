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
  onboarding_completed: boolean | null;
  date_of_birth: string | null;
  height_cm: number | string | null;
};

export type ProfileRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export type LoadedProfile = { profile: Profile; onboardingCompleted: boolean; dateOfBirth: string | null; heightCm: number | null };
export type ProfilePersonalDetails = { dateOfBirth: string | null; heightCm: number | null };
export interface ProfileRepository {
  getOrCreateCurrentProfile(defaults: Profile): Promise<ProfileRepositoryResult<LoadedProfile>>;
  updateCurrentProfile(profile: Profile, personalDetails?: ProfilePersonalDetails): Promise<ProfileRepositoryResult<Profile>>;
}

const asGoal = (value: string | null, fallback: Goal): Goal =>
  value === 'Build muscle' || value === 'Get stronger' || value === 'Lose fat' || value === 'Stay consistent' ? value : fallback;

const asFocus = (value: string | null, fallback: TrainingFocus): TrainingFocus =>
  value === 'Balanced' || value === 'Full Body' || value === 'Upper Body' || value === 'Lower Body' || value === 'Push' || value === 'Pull' || value === 'Legs' || value === 'Strength' || value === 'Hypertrophy' ? value : fallback;

function mapProfile(row: ProfileRow, fallback: Profile): LoadedProfile {
  return { profile: {
    name: row.display_name?.trim() || fallback.name,
    goal: asGoal(row.goal, fallback.goal),
    experience: fallback.experience,
    equipment: row.equipment?.[0] || fallback.equipment,
    frequency: row.training_days_per_week ?? fallback.frequency,
    duration: row.workout_duration_minutes ?? fallback.duration,
    trainingFocus: asFocus(row.training_focus, fallback.trainingFocus),
  }, onboardingCompleted: row.onboarding_completed === true,
  dateOfBirth: row.date_of_birth,
  heightCm: row.height_cm === null ? null : Number(row.height_cm) };
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
  async getOrCreateCurrentProfile(defaults: Profile): Promise<ProfileRepositoryResult<LoadedProfile>> {
    try {
      const id = await currentUserId();
      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes, onboarding_completed, date_of_birth, height_cm')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw readError;
      if (existing) return { data: mapProfile(existing as ProfileRow, defaults), error: null };

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .upsert({ id, ...profileFields(defaults, false) }, { onConflict: 'id', ignoreDuplicates: true })
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes, onboarding_completed, date_of_birth, height_cm')
        .maybeSingle();
      if (insertError) throw insertError;
      if (inserted) return { data: mapProfile(inserted as ProfileRow, defaults), error: null };

      // Another session may have created the row between our read and insert.
      const { data: createdByAnotherSession, error: rereadError } = await supabase
        .from('profiles')
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes, onboarding_completed, date_of_birth, height_cm')
        .eq('id', id)
        .single();
      if (rereadError) throw rereadError;
      return { data: mapProfile(createdByAnotherSession as ProfileRow, defaults), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateCurrentProfile(profile: Profile, personalDetails?: ProfilePersonalDetails): Promise<ProfileRepositoryResult<Profile>> {
    try {
      const id = await currentUserId();
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id,
          ...profileFields(profile),
          ...(personalDetails ? { date_of_birth: personalDetails.dateOfBirth, height_cm: personalDetails.heightCm } : {}),
        }, { onConflict: 'id' })
        .select('id, display_name, goal, training_focus, equipment, training_days_per_week, workout_duration_minutes, onboarding_completed, date_of_birth, height_cm')
        .single();
      if (error) throw error;
      return { data: mapProfile(data as ProfileRow, profile).profile, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
