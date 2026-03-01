-- Storage bucket for PDFs and documents (created via SQL for schema tracking)
-- Note: actual bucket creation uses supabase storage API or dashboard;
-- this file documents the desired state.

-- Documents metadata table for tracking uploaded files
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  file_name   text not null,
  file_path   text not null,
  file_type   text not null default 'application/pdf',
  file_size   bigint,
  created_at  timestamptz not null default now()
);

create index if not exists idx_documents_company on public.documents(company_id);

alter table public.documents enable row level security;
