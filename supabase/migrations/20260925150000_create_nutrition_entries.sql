create table public.nutrition_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  name text not null,
  calories numeric not null check (calories >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  fat numeric not null check (fat >= 0),
  created_at timestamptz not null default now()
);

alter table public.nutrition_entries enable row level security;

create policy "Users can view their own nutrition entries"
on public.nutrition_entries
for select
using (auth.uid() = user_id);

create policy "Users can insert their own nutrition entries"
on public.nutrition_entries
for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own nutrition entries"
on public.nutrition_entries
for delete
using (auth.uid() = user_id);

create index nutrition_entries_user_date_idx
on public.nutrition_entries (user_id, date desc, created_at desc);
