-- Customers: replaces Customers_DB sheet tab
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  address    text,
  city       text,
  state      text,
  zip        text,
  notes      text,
  status     text not null default 'Active' check (status in ('Active', 'Archived')),
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_company on public.customers(company_id);

alter table public.customers enable row level security;
