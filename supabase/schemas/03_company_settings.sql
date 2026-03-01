-- Company settings: replaces the key-value Settings_DB sheet tab
create table if not exists public.company_settings (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade unique,
  profile      jsonb not null default '{}',
  costs        jsonb not null default '{"openCell": 2000, "closedCell": 2600, "laborRate": 85}',
  yields       jsonb not null default '{"openCell": 16000, "closedCell": 4000, "openCellStrokes": 4500, "closedCellStrokes": 4500}',
  foam_counts  jsonb not null default '{"openCellSets": 0, "closedCellSets": 0}',
  sq_ft_rates  jsonb,
  pricing_mode text,
  crews        jsonb not null default '[]',
  updated_at   timestamptz not null default now()
);

alter table public.company_settings enable row level security;
