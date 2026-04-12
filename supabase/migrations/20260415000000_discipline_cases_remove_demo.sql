-- Remove legacy demo rows shipped with the original discipline_cases seed (if present).

delete from public.discipline_cases
where id in (
  'DC-2024-085',
  'DC-2024-086',
  'DC-2024-087',
  'DC-2024-088',
  'DC-2024-089',
  'DC-2024-090',
  'DC-2024-091',
  'DC-2024-092'
);

notify pgrst, 'reload schema';
