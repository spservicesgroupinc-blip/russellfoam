-- Database function to handle company creation during signup.
-- Called after auth.signUp() completes to set up the tenant.
-- Crew invites (role='crew' + company_id in metadata) join an existing company.
-- Admin signups create a fresh company + settings.
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
  -- Crew invite: join existing company (company_id supplied in user metadata)
  if coalesce(new.raw_user_meta_data->>'role', 'admin') = 'crew'
     and (new.raw_user_meta_data->>'company_id') is not null
  then
    new_company_id := (new.raw_user_meta_data->>'company_id')::uuid;

    insert into public.profiles (id, company_id, role, display_name, crew_metadata)
    values (
      new.id,
      new_company_id,
      'crew',
      coalesce(new.raw_user_meta_data->>'display_name', new.email),
      coalesce(new.raw_user_meta_data->'crew_metadata', '{}')
        || jsonb_build_object('email', new.email)
    );

    return new;
  end if;

  -- Admin signup: create new company + profile + default settings
  company_name_val := coalesce(new.raw_user_meta_data->>'company_name', 'My Company');

  insert into public.companies (name)
  values (company_name_val)
  returning id into new_company_id;

  insert into public.profiles (id, company_id, role, display_name)
  values (
    new.id,
    new_company_id,
    'admin',
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  );

  insert into public.company_settings (company_id, profile)
  values (
    new_company_id,
    jsonb_build_object(
      'companyName', company_name_val,
      'addressLine1', '', 'addressLine2', '',
      'city', '', 'state', '', 'zip', '',
      'phone', '',
      'email', coalesce(new.email, ''),
      'website', '', 'logoUrl', ''
    )
  );

  return new;
end;
$$;

-- Trigger: auto-create company + profile when a new user signs up
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
