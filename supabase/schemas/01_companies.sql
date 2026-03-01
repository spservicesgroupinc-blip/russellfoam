-- Companies table: top-level tenant entity
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
