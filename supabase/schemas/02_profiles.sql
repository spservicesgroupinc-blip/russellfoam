-- Profiles: extends Supabase auth.users with app-specific data
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  role          text not null default 'admin' check (role in ('admin', 'crew')),
  display_name  text,
  crew_metadata jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists idx_profiles_company on public.profiles(company_id);

alter table public.profiles enable row level security;

-- Helper function: returns the company_id for the currently authenticated user
create or replace function public.get_my_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from public.profiles where id = auth.uid()
$$;
