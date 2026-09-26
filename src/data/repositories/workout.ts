import type { WeightUnit } from '@/features/units';
import type { WorkoutHistoryItem, WorkoutSession, WorkoutSessionExercise, WorkoutSet } from '@/types/domain';
import { supabase } from '@/lib/supabase';

type WorkoutSessionRow = {
  id: string;
  user_id: string;
  workout_id: string;
  workout_name: string;
  started_at: string;
  elapsed_seconds: number;
  paused: boolean;
  units: string;
  exercise_index: number;
  set_index: number;
  rest_seconds: number | null;
  rest_active: boolean;
  completed_at: string | null;
  volume: number;
  personal_record: boolean;
  personal_records: unknown;
  created_at: string;
};
type SessionExerciseRow = {
  id: string;
  session_id: string;
  position: number;
  exercise_id: string;
  target_sets: number;
  target_reps: string;
  rep_unit: string;
  rest_seconds: number | null;
  skipped: boolean;
};
type WorkoutSetRow = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  completed: boolean;
  completed_at: string | null;
};

export type WorkoutRepositoryResult<T> = { data: T; error: null } | { data: null; error: unknown };
export type PersistedWorkoutData = { activeSession: WorkoutSession | null; history: WorkoutHistoryItem[] };
export interface WorkoutRepository {
  loadCurrentWorkouts(): Promise<WorkoutRepositoryResult<PersistedWorkoutData>>;
  saveActiveSession(session: WorkoutSession): Promise<WorkoutRepositoryResult<null>>;
  completeSession(session: WorkoutSession, history: WorkoutHistoryItem): Promise<WorkoutRepositoryResult<null>>;
  discardSession(id: string): Promise<WorkoutRepositoryResult<null>>;
  clearCompletedSessions(): Promise<WorkoutRepositoryResult<null>>;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user is available for workout access.');
  return data.user.id;
}

function fromTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function toTimestamp(value: number | undefined): string | null {
  return value === undefined ? null : new Date(value).toISOString();
}

function mapSession(row: WorkoutSessionRow, exerciseRows: SessionExerciseRow[], setRows: WorkoutSetRow[]): WorkoutSession {
  return {
    id: row.id,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    startedAt: fromTimestamp(row.started_at) ?? fromTimestamp(row.created_at) ?? Date.now(),
    elapsedSeconds: row.elapsed_seconds,
    paused: row.paused,
    units: row.units as WeightUnit,
    exercises: exerciseRows.filter(exercise => exercise.session_id === row.id).map(exercise => ({
      id: exercise.id,
      position: exercise.position,
      exerciseId: exercise.exercise_id,
      targetSets: exercise.target_sets,
      targetReps: exercise.target_reps,
      repUnit: exercise.rep_unit as WorkoutSessionExercise['repUnit'],
      ...(exercise.rest_seconds === null ? {} : { restSeconds: exercise.rest_seconds }),
      skipped: exercise.skipped,
      sets: setRows.filter(set => set.session_exercise_id === exercise.id).map(set => ({
        id: set.id,
        setNumber: set.set_number,
        weight: Number(set.weight),
        reps: set.reps,
        completed: set.completed,
        ...(fromTimestamp(set.completed_at) === undefined ? {} : { completedAt: fromTimestamp(set.completed_at) }),
      })),
    })).sort((a, b) => a.position - b.position),
    exerciseIndex: row.exercise_index,
    setIndex: row.set_index,
    restSeconds: row.rest_seconds,
    restActive: row.rest_active,
  };
}

function personalRecords(value: unknown): WorkoutHistoryItem['personalRecords'] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { exerciseId: string; weight: number; reps: number } =>
    typeof item === 'object' && item !== null &&
    'exerciseId' in item && typeof item.exerciseId === 'string' &&
    'weight' in item && typeof item.weight === 'number' &&
    'reps' in item && typeof item.reps === 'number');
}

function mapHistory(row: WorkoutSessionRow, session: WorkoutSession): WorkoutHistoryItem {
  const completedAt = fromTimestamp(row.completed_at);
  const date = completedAt === undefined
    ? new Date(row.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : new Date(completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    id: row.id,
    workoutId: row.workout_id,
    name: row.workout_name,
    date,
    ...(completedAt === undefined ? {} : { completedAt }),
    duration: Math.max(1, Math.round(row.elapsed_seconds / 60)),
    volume: Math.round(Number(row.volume)),
    units: row.units as WeightUnit,
    personalRecord: row.personal_record,
    personalRecords: personalRecords(row.personal_records),
    exercises: session.exercises.map(exercise => ({
      id: exercise.id,
      position: exercise.position,
      exerciseId: exercise.exerciseId,
      skipped: exercise.skipped,
      sets: exercise.sets.filter(set => set.completed),
    })),
  };
}

function sessionFields(session: WorkoutSession, userId: string, history?: WorkoutHistoryItem) {
  return {
    id: session.id,
    user_id: userId,
    workout_id: session.workoutId,
    workout_name: session.workoutName,
    started_at: new Date(session.startedAt).toISOString(),
    elapsed_seconds: session.elapsedSeconds,
    paused: session.paused,
    units: session.units,
    exercise_index: session.exerciseIndex,
    set_index: session.setIndex,
    rest_seconds: session.restSeconds,
    rest_active: session.restActive,
    completed_at: toTimestamp(history?.completedAt),
    volume: history?.volume ?? 0,
    personal_record: history?.personalRecord ?? false,
    personal_records: history?.personalRecords ?? [],
    updated_at: new Date().toISOString(),
  };
}

function exerciseFields(exercise: WorkoutSessionExercise, sessionId: string) {
  return {
    id: exercise.id,
    session_id: sessionId,
    position: exercise.position,
    exercise_id: exercise.exerciseId,
    target_sets: exercise.targetSets,
    target_reps: exercise.targetReps,
    rep_unit: exercise.repUnit,
    rest_seconds: exercise.restSeconds ?? null,
    skipped: exercise.skipped,
    updated_at: new Date().toISOString(),
  };
}

function setFields(set: WorkoutSet, exerciseId: string) {
  return {
    id: set.id,
    session_exercise_id: exerciseId,
    set_number: set.setNumber,
    weight: set.weight,
    reps: set.reps,
    completed: Boolean(set.completed),
    completed_at: toTimestamp(set.completedAt),
    updated_at: new Date().toISOString(),
  };
}

async function syncSession(session: WorkoutSession, userId: string, history?: WorkoutHistoryItem): Promise<void> {
  const { error: sessionError } = await supabase
    .from('workout_sessions')
    .upsert(sessionFields(session, userId, history), { onConflict: 'id' });
  if (sessionError) throw sessionError;

  const { data: existingExercises, error: existingExercisesError } = await supabase
    .from('workout_session_exercises').select('id').eq('session_id', session.id);
  if (existingExercisesError) throw existingExercisesError;
  if (session.exercises.length) {
    const { error } = await supabase.from('workout_session_exercises')
      .upsert(session.exercises.map(exercise => exerciseFields(exercise, session.id)), { onConflict: 'id' });
    if (error) throw error;
  }

  const currentExerciseIds = new Set(session.exercises.map(exercise => exercise.id));
  const staleExerciseIds = ((existingExercises ?? []) as { id: string }[]).map(exercise => exercise.id).filter(id => !currentExerciseIds.has(id));
  if (staleExerciseIds.length) {
    const { error } = await supabase.from('workout_session_exercises').delete().in('id', staleExerciseIds);
    if (error) throw error;
  }

  for (const exercise of session.exercises) {
    const { data: existingSets, error: existingSetsError } = await supabase
      .from('workout_sets').select('id').eq('session_exercise_id', exercise.id);
    if (existingSetsError) throw existingSetsError;
    if (exercise.sets.length) {
      const { error } = await supabase.from('workout_sets')
        .upsert(exercise.sets.map(set => setFields(set, exercise.id)), { onConflict: 'id' });
      if (error) throw error;
    }
    const currentSetIds = new Set(exercise.sets.map(set => set.id));
    const staleSetIds = ((existingSets ?? []) as { id: string }[]).map(set => set.id).filter(id => !currentSetIds.has(id));
    if (staleSetIds.length) {
      const { error } = await supabase.from('workout_sets').delete().in('id', staleSetIds);
      if (error) throw error;
    }
  }
}

export const workoutRepository: WorkoutRepository = {
  async loadCurrentWorkouts() {
    try {
      const userId = await currentUserId();
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('id, user_id, workout_id, workout_name, started_at, elapsed_seconds, paused, units, exercise_index, set_index, rest_seconds, rest_active, completed_at, volume, personal_record, personal_records, created_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });
      if (sessionsError) throw sessionsError;
      const rows = (sessions ?? []) as WorkoutSessionRow[];
      const activeRow = rows.find(row => row.completed_at === null) ?? null;
      const completedRows = rows.filter(row => row.completed_at !== null);
      const sessionIds = [...completedRows.map(row => row.id), ...(activeRow ? [activeRow.id] : [])];
      if (!sessionIds.length) return { data: { activeSession: null, history: [] }, error: null };

      const { data: exercises, error: exercisesError } = await supabase
        .from('workout_session_exercises')
        .select('id, session_id, position, exercise_id, target_sets, target_reps, rep_unit, rest_seconds, skipped')
        .in('session_id', sessionIds)
        .order('position', { ascending: true });
      if (exercisesError) throw exercisesError;
      const exerciseRows = (exercises ?? []) as SessionExerciseRow[];
      const exerciseIds = exerciseRows.map(exercise => exercise.id);
      let setRows: WorkoutSetRow[] = [];
      if (exerciseIds.length) {
        const { data: sets, error: setsError } = await supabase
          .from('workout_sets')
          .select('id, session_exercise_id, set_number, weight, reps, completed, completed_at')
          .in('session_exercise_id', exerciseIds)
          .order('set_number', { ascending: true });
        if (setsError) throw setsError;
        setRows = (sets ?? []) as WorkoutSetRow[];
      }

      const history = completedRows.map(row => mapHistory(row, mapSession(row, exerciseRows, setRows)));
      const activeSession = activeRow ? mapSession(activeRow, exerciseRows, setRows) : null;
      return { data: { activeSession, history }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async saveActiveSession(session) {
    try {
      await syncSession(session, await currentUserId());
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async completeSession(session, history) {
    try {
      await syncSession(session, await currentUserId(), history);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async discardSession(id) {
    try {
      const userId = await currentUserId();
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id).eq('user_id', userId).is('completed_at', null);
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async clearCompletedSessions() {
    try {
      const userId = await currentUserId();
      const { error } = await supabase.from('workout_sessions').delete().eq('user_id', userId).not('completed_at', 'is', null);
      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
