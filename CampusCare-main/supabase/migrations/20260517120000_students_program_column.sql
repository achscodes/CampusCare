-- Program field for analytics (Reports & Analytics pie charts); optional school split via program text (SECA/SASE/SBMA).

alter table public.students add column if not exists program text;

comment on column public.students.program is 'Academic program label; used for HSO analytics and roster display.';

notify pgrst, 'reload schema';
