-- ============================================================
-- RFE Foam Pro — Supabase Schema
-- Run this in Supabase SQL Editor to bootstrap the database.
-- After running, create a "documents" storage bucket (private).
-- ============================================================

-- ─── Helper Function ──────────────────────────────────────
-- Returns the company_id of the currently authenticated user.
-- Used by all RLS policies to enforce multi-tenant isolation.
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── Tables ───────────────────────────────────────────────

-- 1. companies
CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. profiles (one row per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id     uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  role           text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'crew')),
  display_name   text,
  crew_metadata  jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. company_settings (one row per company)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid UNIQUE NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile     jsonb DEFAULT '{}',
  costs       jsonb DEFAULT '{"openCell": 2000, "closedCell": 2600, "laborRate": 85}',
  yields      jsonb DEFAULT '{"openCell": 16000, "closedCell": 4000}',
  foam_counts jsonb DEFAULT '{"openCellSets": 0, "closedCellSets": 0}',
  crews       jsonb DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. customers
CREATE TABLE IF NOT EXISTS public.customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  phone       text,
  address     text,
  city        text,
  state       text,
  zip         text,
  notes       text,
  status      text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. estimates (id is app-generated random string, not UUID)
CREATE TABLE IF NOT EXISTS public.estimates (
  id                text PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id       uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Work Order', 'Archived')),
  execution_status  text NOT NULL DEFAULT 'Not Started' CHECK (execution_status IN ('Not Started', 'In Progress', 'Completed')),
  date              timestamptz NOT NULL DEFAULT now(),
  scheduled_date    timestamptz,
  assigned_crew_id  text,
  customer_snapshot jsonb DEFAULT '{}',
  inputs            jsonb DEFAULT '{}',
  results           jsonb DEFAULT '{}',
  materials         jsonb DEFAULT '{}',
  wall_settings     jsonb DEFAULT '{}',
  roof_settings     jsonb DEFAULT '{}',
  actuals           jsonb,
  notes             text,
  pdf_url           text,
  work_order_url    text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 6. warehouse_items (id is app-generated string)
CREATE TABLE IF NOT EXISTS public.warehouse_items (
  id          text PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 0,
  unit        text,
  unit_cost   numeric NOT NULL DEFAULT 0,
  min_level   numeric
);

-- 7. material_logs
CREATE TABLE IF NOT EXISTS public.material_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  estimate_id    text REFERENCES public.estimates(id) ON DELETE SET NULL,
  date           timestamptz NOT NULL DEFAULT now(),
  customer_name  text,
  material_name  text NOT NULL,
  quantity       numeric NOT NULL DEFAULT 0,
  unit           text,
  logged_by      text
);

-- 8. documents (tracks uploaded PDFs in Storage)
CREATE TABLE IF NOT EXISTS public.documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  estimate_id  text REFERENCES public.estimates(id) ON DELETE SET NULL,
  file_name    text NOT NULL,
  file_path    text NOT NULL,
  file_type    text,
  file_size    bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Auto-Provision Trigger ───────────────────────────────
-- Fires when a new user registers via Supabase Auth.
-- For admin: creates company, profile, and default settings.
-- For crew:  creates profile only (company_id assigned later by admin).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id  uuid;
  user_role       text;
  company_name    text;
  display_name    text;
BEGIN
  user_role    := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company');
  display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);

  IF user_role = 'admin' THEN
    -- 1. Create company
    INSERT INTO public.companies (name)
    VALUES (company_name)
    RETURNING id INTO new_company_id;

    -- 2. Create admin profile
    INSERT INTO public.profiles (id, company_id, role, display_name)
    VALUES (NEW.id, new_company_id, 'admin', display_name);

    -- 3. Seed default company settings
    INSERT INTO public.company_settings (company_id, profile)
    VALUES (
      new_company_id,
      jsonb_build_object(
        'companyName', company_name,
        'addressLine1', '',
        'addressLine2', '',
        'city', '',
        'state', '',
        'zip', '',
        'phone', '',
        'email', NEW.email,
        'website', '',
        'logoUrl', ''
      )
    );

  ELSE
    -- Crew member: create profile with null company_id.
    -- The admin's inviteCrewMember() call will update it.
    INSERT INTO public.profiles (id, company_id, role, display_name)
    VALUES (NEW.id, NULL, 'crew', display_name);
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents       ENABLE ROW LEVEL SECURITY;

-- companies: read own company only
CREATE POLICY "companies: own company"
  ON public.companies FOR SELECT
  USING (id = get_my_company_id());

-- profiles: read own profile + all profiles in same company
CREATE POLICY "profiles: own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR company_id = get_my_company_id());

CREATE POLICY "profiles: update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles: admin update crew profiles"
  ON public.profiles FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "profiles: insert via trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (true); -- trigger runs as SECURITY DEFINER; client inserts not needed

-- company_settings: full access within own company
CREATE POLICY "company_settings: own company"
  ON public.company_settings FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- customers: full access within own company
CREATE POLICY "customers: own company"
  ON public.customers FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- estimates: full access within own company
CREATE POLICY "estimates: own company"
  ON public.estimates FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- warehouse_items: full access within own company
CREATE POLICY "warehouse_items: own company"
  ON public.warehouse_items FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- material_logs: full access within own company
CREATE POLICY "material_logs: own company"
  ON public.material_logs FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- documents: full access within own company
CREATE POLICY "documents: own company"
  ON public.documents FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- ─── Storage ──────────────────────────────────────────────
-- NOTE: Create a private bucket named "documents" manually in the
-- Supabase dashboard under Storage → New Bucket.
-- Then add this policy so authenticated users can read/write their own company's files:

-- (Run after creating the bucket)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage RLS policies for the documents bucket:
-- Allow authenticated users to upload to their company's folder:
CREATE POLICY "documents: upload own company"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );

CREATE POLICY "documents: read own company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );

CREATE POLICY "documents: update own company"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );

-- ─── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_company_id        ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id       ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_company_id       ON public.estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_date             ON public.estimates(date DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_company_id ON public.warehouse_items(company_id);
CREATE INDEX IF NOT EXISTS idx_material_logs_company_id   ON public.material_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_material_logs_date         ON public.material_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_company_id       ON public.documents(company_id);
