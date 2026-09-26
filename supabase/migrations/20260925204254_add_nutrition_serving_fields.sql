alter table public.nutrition_entries
  add column if not exists quantity numeric(10,2) null,
  add column if not exists serving_unit text null;

alter table public.nutrition_entries
  alter column quantity type numeric(10,2) using quantity::numeric(10,2),
  alter column quantity drop not null,
  alter column serving_unit drop not null;

notify pgrst, 'reload schema';
