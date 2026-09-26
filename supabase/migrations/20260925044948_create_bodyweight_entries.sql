create table public.bodyweight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null,
  weight numeric(6,2) not null,
  units text not null,
  created_at timestamptz not null default now()
);

alter table public.bodyweight_entries enable row level security;

create policy "Users can view their own bodyweight entries"
on public.bodyweight_entries
for select
using (auth.uid() = user_id);

create policy "Users can insert their own bodyweight entries"
on public.bodyweight_entries
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own bodyweight entries"
on public.bodyweight_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own bodyweight entries"
on public.bodyweight_entries
for delete
using (auth.uid() = user_id);

create index bodyweight_entries_user_recorded_at_idx
on public.bodyweight_entries (user_id, recorded_at desc);
