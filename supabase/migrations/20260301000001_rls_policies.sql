-- RLS Policies for multi-tenant isolation
-- Per declarative schema caveats, RLS policies must be managed via versioned migrations.

-- ============================================================
-- COMPANIES
-- ============================================================
-- Users can only see their own company
create policy "Users can view own company"
  on public.companies for select
  using (id = public.get_my_company_id());

-- ============================================================
-- PROFILES
-- ============================================================
-- Users can read all profiles in their company (needed for crew lists)
create policy "Company members can view profiles"
  on public.profiles for select
  using (company_id = public.get_my_company_id());

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ============================================================
-- COMPANY_SETTINGS
-- ============================================================
-- All company members can read settings
create policy "Company members can read settings"
  on public.company_settings for select
  using (company_id = public.get_my_company_id());

-- Only admins can modify settings
create policy "Admins can modify settings"
  on public.company_settings for update
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert settings"
  on public.company_settings for insert
  with check (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- CUSTOMERS
-- ============================================================
create policy "Company members can view customers"
  on public.customers for select
  using (company_id = public.get_my_company_id());

create policy "Admins can insert customers"
  on public.customers for insert
  with check (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update customers"
  on public.customers for update
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete customers"
  on public.customers for delete
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- ESTIMATES
-- ============================================================
-- Admins see all company estimates, crew see only their assigned ones
create policy "Admins can view all company estimates"
  on public.estimates for select
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Crew can view assigned estimates"
  on public.estimates for select
  using (
    company_id = public.get_my_company_id()
    and (
      assigned_crew_id = auth.uid()
      or assigned_crew_id is null
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'crew'
    )
  );

create policy "Admins can insert estimates"
  on public.estimates for insert
  with check (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update estimates"
  on public.estimates for update
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Crew can update execution status and actuals on assigned jobs
create policy "Crew can update assigned estimates"
  on public.estimates for update
  using (
    company_id = public.get_my_company_id()
    and assigned_crew_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'crew'
    )
  );

create policy "Admins can delete estimates"
  on public.estimates for delete
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- WAREHOUSE_ITEMS
-- ============================================================
create policy "Company members can view warehouse items"
  on public.warehouse_items for select
  using (company_id = public.get_my_company_id());

create policy "Admins can insert warehouse items"
  on public.warehouse_items for insert
  with check (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update warehouse items"
  on public.warehouse_items for update
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete warehouse items"
  on public.warehouse_items for delete
  using (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- MATERIAL_LOGS
-- ============================================================
create policy "Company members can view material logs"
  on public.material_logs for select
  using (company_id = public.get_my_company_id());

-- Both admins and crew can insert logs
create policy "Company members can insert material logs"
  on public.material_logs for insert
  with check (company_id = public.get_my_company_id());

-- ============================================================
-- DOCUMENTS
-- ============================================================
create policy "Company members can view documents"
  on public.documents for select
  using (company_id = public.get_my_company_id());

create policy "Admins can insert documents"
  on public.documents for insert
  with check (
    company_id = public.get_my_company_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- STORAGE BUCKET SETUP (DML — must be in migration)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Company members can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );

create policy "Company members can read own documents"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );
