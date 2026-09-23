-- ============================================================
-- Steadiifit: Profiles + User Settings
-- ============================================================

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  date_of_birth date,
  gender text,
  height_cm numeric(5,2),
  goal text,
  training_focus text,
  equipment text[] not null default '{}',
  training_days_per_week integer,
  workout_duration_minutes integer,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- User Settings
-- ------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unit_system text not null default 'metric',
  rest_timer_seconds integer not null default 90,
  auto_start_rest_timer boolean not null default true,
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

-- Profiles: users can access only their own profile

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can delete their own profile"
on public.profiles
for delete
using (auth.uid() = id);

-- User settings: users can access only their own settings

create policy "Users can view their own settings"
on public.user_settings
for select
using (auth.uid() = user_id);

create policy "Users can insert their own settings"
on public.user_settings
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own settings"
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own settings"
on public.user_settings
for delete
using (auth.uid() = user_id);
