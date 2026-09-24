import type { Goal, PlanDay, PlanExercise, PlanPreferences, TrainingFocus, WorkoutPlan } from '@/types/domain';
import { supabase } from '@/lib/supabase';

type WorkoutPlanRow = {
  id: string;
  user_id: string;
  started_at: string;
  goal: string;
  experience: string;
  frequency: number;
  equipment: string;
  duration: number;
  focus: string;
  created_at: string;
};
type PlanDayRow = {
  id: string;
  plan_id: string;
  weekday: number;
  day: number;
  workout_id: string | null;
  status: PlanDay['status'];
  title: string | null;
  focus: string | null;
  duration: number | null;
};
type PlanExerciseRow = {
  id: string;
  plan_day_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  rep_range: string;
  rest_seconds: number;
};

export type PlanRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export interface PlanRepository {
  loadCurrentPlan(): Promise<PlanRepositoryResult<WorkoutPlan | null>>;
  saveCurrentPlan(plan: WorkoutPlan): Promise<PlanRepositoryResult<WorkoutPlan>>;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user is available for plan access.');
  return data.user.id;
}

function mapPlan(plan: WorkoutPlanRow, days: PlanDayRow[], exercises: PlanExerciseRow[]): WorkoutPlan {
  const preferences: PlanPreferences = {
    goal: plan.goal as Goal,
    experience: plan.experience,
    frequency: plan.frequency,
    equipment: plan.equipment,
    duration: plan.duration,
    focus: plan.focus as TrainingFocus,
  };
  return {
    id: plan.id,
    startedAt: Date.parse(plan.started_at) || Date.parse(plan.created_at),
    preferences,
    days: days.map(day => ({
      id: day.id,
      weekday: day.weekday,
      day: day.day,
      workoutId: day.workout_id,
      status: day.status,
      ...(day.title === null ? {} : { title: day.title }),
      ...(day.focus === null ? {} : { focus: day.focus }),
      ...(day.duration === null ? {} : { duration: day.duration }),
      exercises: exercises.filter(exercise => exercise.plan_day_id === day.id).map(exercise => ({
        id: exercise.id,
        exerciseId: exercise.exercise_id,
        position: exercise.position,
        sets: exercise.sets,
        repRange: exercise.rep_range,
        restSeconds: exercise.rest_seconds,
      })),
    })),
  };
}

function planFields(plan: WorkoutPlan, userId: string) {
  return {
    id: plan.id,
    user_id: userId,
    started_at: new Date(plan.startedAt).toISOString(),
    goal: plan.preferences.goal,
    experience: plan.preferences.experience,
    frequency: plan.preferences.frequency,
    equipment: plan.preferences.equipment,
    duration: plan.preferences.duration,
    focus: plan.preferences.focus,
    updated_at: new Date().toISOString(),
  };
}

function dayFields(day: PlanDay, planId: string) {
  return {
    id: day.id,
    plan_id: planId,
    weekday: day.weekday,
    day: day.day,
    workout_id: day.workoutId,
    status: day.status,
    title: day.title ?? null,
    focus: day.focus ?? null,
    duration: day.duration ?? null,
    updated_at: new Date().toISOString(),
  };
}

function exerciseFields(exercise: PlanExercise, dayId: string) {
  return {
    id: exercise.id,
    plan_day_id: dayId,
    exercise_id: exercise.exerciseId,
    position: exercise.position,
    sets: exercise.sets,
    rep_range: exercise.repRange,
    rest_seconds: exercise.restSeconds,
    updated_at: new Date().toISOString(),
  };
}

export const planRepository: PlanRepository = {
  async loadCurrentPlan() {
    try {
      const userId = await currentUserId();
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('id, user_id, started_at, goal, experience, frequency, equipment, duration, focus, created_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan) return { data: null, error: null };

      const planRow = plan as WorkoutPlanRow;
      const { data: days, error: daysError } = await supabase
        .from('plan_days')
        .select('id, plan_id, weekday, day, workout_id, status, title, focus, duration')
        .eq('plan_id', planRow.id)
        .order('weekday', { ascending: true });
      if (daysError) throw daysError;
      const dayRows = (days ?? []) as PlanDayRow[];
      const dayIds = dayRows.map(day => day.id);
      let exerciseRows: PlanExerciseRow[] = [];
      if (dayIds.length) {
        const { data: exercises, error: exercisesError } = await supabase
          .from('plan_exercises')
          .select('id, plan_day_id, exercise_id, position, sets, rep_range, rest_seconds')
          .in('plan_day_id', dayIds)
          .order('position', { ascending: true });
        if (exercisesError) throw exercisesError;
        exerciseRows = (exercises ?? []) as PlanExerciseRow[];
      }
      return { data: mapPlan(planRow, dayRows, exerciseRows), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async saveCurrentPlan(plan) {
    try {
      const userId = await currentUserId();
      const { error: planError } = await supabase
        .from('workout_plans')
        .upsert(planFields(plan, userId), { onConflict: 'id' });
      if (planError) throw planError;

      const { data: existingDays, error: existingDaysError } = await supabase
        .from('plan_days')
        .select('id')
        .eq('plan_id', plan.id);
      if (existingDaysError) throw existingDaysError;
      if (plan.days.length) {
        const { error: daysError } = await supabase
          .from('plan_days')
          .upsert(plan.days.map(day => dayFields(day, plan.id)), { onConflict: 'id' });
        if (daysError) throw daysError;
      }

      const currentDayIds = new Set(plan.days.map(day => day.id));
      const staleDayIds = ((existingDays ?? []) as { id: string }[]).map(day => day.id).filter(id => !currentDayIds.has(id));
      if (staleDayIds.length) {
        const { error } = await supabase.from('plan_days').delete().in('id', staleDayIds);
        if (error) throw error;
      }

      for (const day of plan.days) {
        const exercises = day.exercises ?? [];
        const { data: existingExercises, error: existingExercisesError } = await supabase
          .from('plan_exercises')
          .select('id')
          .eq('plan_day_id', day.id);
        if (existingExercisesError) throw existingExercisesError;
        if (exercises.length) {
          const { error: exercisesError } = await supabase
            .from('plan_exercises')
            .upsert(exercises.map(exercise => exerciseFields(exercise, day.id)), { onConflict: 'id' });
          if (exercisesError) throw exercisesError;
        }
        const currentExerciseIds = new Set(exercises.map(exercise => exercise.id));
        const staleExerciseIds = ((existingExercises ?? []) as { id: string }[]).map(exercise => exercise.id).filter(id => !currentExerciseIds.has(id));
        if (staleExerciseIds.length) {
          const { error } = await supabase.from('plan_exercises').delete().in('id', staleExerciseIds);
          if (error) throw error;
        }
      }

      return { data: plan, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
