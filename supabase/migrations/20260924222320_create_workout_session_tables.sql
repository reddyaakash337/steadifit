create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  workout_name text not null,
  started_at timestamptz not null,
  elapsed_seconds integer not null default 0,
  paused boolean not null default false,
  units text not null,
  exercise_index integer not null default 0,
  set_index integer not null default 0,
  rest_seconds integer,
  rest_active boolean not null default false,
  completed_at timestamptz,
  volume numeric not null default 0,
  personal_record boolean not null default false,
  personal_records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_session_exercises (
  id uuid primary key,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  position integer not null,
  exercise_id text not null,
  target_sets integer not null,
  target_reps text not null,
  rep_unit text not null,
  rest_seconds integer,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_sets (
  id uuid primary key,
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric not null default 0,
  reps integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sessions_user_id_idx
  on public.workout_sessions(user_id);

create index workout_session_exercises_session_id_idx
  on public.workout_session_exercises(session_id);

create index workout_sets_session_exercise_id_idx
  on public.workout_sets(session_exercise_id);

alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;

create policy "Users can view own workout sessions"
  on public.workout_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own workout sessions"
  on public.workout_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workout sessions"
  on public.workout_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own workout sessions"
  on public.workout_sessions
  for delete
  using (auth.uid() = user_id);

create policy "Users can view own session exercises"
  on public.workout_session_exercises
  for select
  using (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert own session exercises"
  on public.workout_session_exercises
  for insert
  with check (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update own session exercises"
  on public.workout_session_exercises
  for update
  using (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete own session exercises"
  on public.workout_session_exercises
  for delete
  using (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can view own workout sets"
  on public.workout_sets
  for select
  using (
    exists (
      select 1
      from public.workout_session_exercises
      join public.workout_sessions
        on workout_sessions.id = workout_session_exercises.session_id
      where workout_session_exercises.id = workout_sets.session_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert own workout sets"
  on public.workout_sets
  for insert
  with check (
    exists (
      select 1
      from public.workout_session_exercises
      join public.workout_sessions
        on workout_sessions.id = workout_session_exercises.session_id
      where workout_session_exercises.id = workout_sets.session_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can update own workout sets"
  on public.workout_sets
  for update
  using (
    exists (
      select 1
      from public.workout_session_exercises
      join public.workout_sessions
        on workout_sessions.id = workout_session_exercises.session_id
      where workout_session_exercises.id = workout_sets.session_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_session_exercises
      join public.workout_sessions
        on workout_sessions.id = workout_session_exercises.session_id
      where workout_session_exercises.id = workout_sets.session_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete own workout sets"
  on public.workout_sets
  for delete
  using (
    exists (
      select 1
      from public.workout_session_exercises
      join public.workout_sessions
        on workout_sessions.id = workout_session_exercises.session_id
      where workout_session_exercises.id = workout_sets.session_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );