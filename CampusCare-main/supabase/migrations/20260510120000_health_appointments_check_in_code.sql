-- Align health_appointments check_in_code column and CH-#### defaults.
-- Keeps check_in_code; renames legacy checkin_code only when present.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_appointments'
      and column_name = 'checkin_code'
  ) then
    alter table public.health_appointments rename column checkin_code to check_in_code;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'health_appointments_checkin_code_idx'
  ) then
    alter index public.health_appointments_checkin_code_idx
      rename to health_appointments_check_in_code_idx;
  end if;
end $$;

create sequence if not exists public.health_appointments_check_in_code_seq;

do $$
declare
  mx int := 0;
  c text;
begin
  for c in
    select check_in_code
    from public.health_appointments
    where check_in_code is not null and btrim(check_in_code) <> ''
  loop
    if upper(btrim(c)) ~ '^CH-[0-9]+$' then
      mx := greatest(mx, substring(btrim(c) from 4)::int);
    end if;
  end loop;
  if mx = 0 then
    perform setval('public.health_appointments_check_in_code_seq', 0, false);
  else
    perform setval('public.health_appointments_check_in_code_seq', mx, true);
  end if;
end $$;

create or replace function public.next_health_check_in_code()
returns text
language sql
set search_path = public
as $$
  select 'CH-' || lpad(
    n::text,
    greatest(4, char_length(n::text)),
    '0'
  )
  from (select nextval('public.health_appointments_check_in_code_seq') as n) s;
$$;

alter table public.health_appointments
  alter column check_in_code set default (public.next_health_check_in_code());

notify pgrst, 'reload schema';
