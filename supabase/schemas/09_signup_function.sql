-- Database function to handle company creation during signup.
-- Called after auth.signUp() completes to set up the tenant.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  company_name_val text;
begin
  -- Extract company name from user metadata (passed during signUp)
  company_name_val := coalesce(new.raw_user_meta_data->>'company_name', 'My Company');

  -- Create the company
  insert into public.companies (name)
  values (company_name_val)
  returning id into new_company_id;

  -- Create the profile linking user to company
  insert into public.profiles (id, company_id, role, display_name)
  values (
    new.id,
    new_company_id,
    coalesce(new.raw_user_meta_data->>'role', 'admin'),
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  );

  -- Create default company settings
  insert into public.company_settings (company_id, profile)
  values (
    new_company_id,
    jsonb_build_object(
      'companyName', company_name_val,
      'addressLine1', '',
      'addressLine2', '',
      'city', '',
      'state', '',
      'zip', '',
      'phone', '',
      'email', coalesce(new.email, ''),
      'website', '',
      'logoUrl', ''
    )
  );

  return new;
end;
$$;

-- Trigger: auto-create company + profile when a new user signs up
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
