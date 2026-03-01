-- Estimates: replaces Estimates_DB sheet tab
create table if not exists public.estimates (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  customer_id       uuid references public.customers(id) on delete set null,
  status            text not null default 'Draft' check (status in ('Draft', 'Work Order', 'Archived')),
  execution_status  text not null default 'Not Started' check (execution_status in ('Not Started', 'In Progress', 'Completed')),
  date              timestamptz not null default now(),
  scheduled_date    timestamptz,
  assigned_crew_id  uuid, -- no FK: local crews exist only in company_settings.crews JSONB
  customer_snapshot jsonb not null default '{}',
  inputs            jsonb not null default '{}',
  results           jsonb not null default '{}',
  materials         jsonb not null default '{}',
  wall_settings     jsonb not null default '{}',
  roof_settings     jsonb not null default '{}',
  actuals           jsonb,
  notes             text,
  pdf_url           text,
  work_order_url    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_estimates_company on public.estimates(company_id);
create index if not exists idx_estimates_customer on public.estimates(customer_id);
create index if not exists idx_estimates_status on public.estimates(company_id, status);

alter table public.estimates enable row level security;
