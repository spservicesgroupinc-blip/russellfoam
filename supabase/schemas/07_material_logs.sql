-- Material logs: replaces Material_Log_DB sheet tab (append-only ledger)
create table if not exists public.material_logs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  estimate_id   uuid references public.estimates(id) on delete set null,
  date          timestamptz not null default now(),
  customer_name text,
  material_name text not null,
  quantity      numeric not null,
  unit          text,
  logged_by     text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_material_logs_company on public.material_logs(company_id);
create index if not exists idx_material_logs_estimate on public.material_logs(estimate_id);

alter table public.material_logs enable row level security;
