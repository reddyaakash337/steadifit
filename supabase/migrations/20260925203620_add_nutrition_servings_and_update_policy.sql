alter table public.nutrition_entries
  add column quantity numeric null check (quantity is null or quantity > 0),
  add column serving_unit text null;

create policy "Users can update their own nutrition entries"
on public.nutrition_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
