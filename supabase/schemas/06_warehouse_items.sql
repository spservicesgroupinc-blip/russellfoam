-- Warehouse items: replaces Inventory_DB sheet tab
create table if not exists public.warehouse_items (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  quantity   numeric not null default 0,
  unit       text,
  unit_cost  numeric not null default 0,
  min_level  numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_warehouse_company on public.warehouse_items(company_id);

alter table public.warehouse_items enable row level security;
