create table public.workout_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  goal text not null,
  experience text not null,
  frequency integer not null,
  equipment text not null,
  duration integer not null,
  focus text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_days (
  id uuid primary key,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  weekday integer not null,
  day integer not null,
  workout_id text,
  status text not null,
  title text,
  focus text,
  duration integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_exercises (
  id uuid primary key,
  plan_day_id uuid not null references public.plan_days(id) on delete cascade,
  exercise_id text not null,
  position integer not null,
  sets integer not null,
  rep_range text not null,
  rest_seconds integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_plans_user_id_idx
  on public.workout_plans(user_id);

create index plan_days_plan_id_idx
  on public.plan_days(plan_id);

create index plan_exercises_plan_day_id_idx
  on public.plan_exercises(plan_day_id);

alter table public.workout_plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_exercises enable row level security;

create policy "Users can view their own workout plans"
  on public.workout_plans
  for select
  using (auth.uid() = user_id);

create policy "Users can create their own workout plans"
  on public.workout_plans
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workout plans"
  on public.workout_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own workout plans"
  on public.workout_plans
  for delete
  using (auth.uid() = user_id);

create policy "Users can view their own plan days"
  on public.plan_days
  for select
  using (
    exists (
      select 1
      from public.workout_plans
      where workout_plans.id = plan_days.plan_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can create their own plan days"
  on public.plan_days
  for insert
  with check (
    exists (
      select 1
      from public.workout_plans
      where workout_plans.id = plan_days.plan_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can update their own plan days"
  on public.plan_days
  for update
  using (
    exists (
      select 1
      from public.workout_plans
      where workout_plans.id = plan_days.plan_id
        and workout_plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_plans
      where workout_plans.id = plan_days.plan_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can delete their own plan days"
  on public.plan_days
  for delete
  using (
    exists (
      select 1
      from public.workout_plans
      where workout_plans.id = plan_days.plan_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can view their own plan exercises"
  on public.plan_exercises
  for select
  using (
    exists (
      select 1
      from public.plan_days
      join public.workout_plans
        on workout_plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can create their own plan exercises"
  on public.plan_exercises
  for insert
  with check (
    exists (
      select 1
      from public.plan_days
      join public.workout_plans
        on workout_plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can update their own plan exercises"
  on public.plan_exercises
  for update
  using (
    exists (
      select 1
      from public.plan_days
      join public.workout_plans
        on workout_plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id
        and workout_plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.plan_days
      join public.workout_plans
        on workout_plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id
        and workout_plans.user_id = auth.uid()
    )
  );

create policy "Users can delete their own plan exercises"
  on public.plan_exercises
  for delete
  using (
    exists (
      select 1
      from public.plan_days
      join public.workout_plans
        on workout_plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id
        and workout_plans.user_id = auth.uid()
    )
  );