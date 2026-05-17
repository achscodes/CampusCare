-- App no longer stores case priority on discipline_cases; drop if present.

alter table public.discipline_cases
  drop constraint if exists discipline_cases_priority_check;

alter table public.discipline_cases
  drop column if exists priority;

notify pgrst, 'reload schema';
