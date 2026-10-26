-- Two-step sign-in (authenticator codes) is no longer required for admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Remove existing authenticator set-ups so admins aren't asked for a code.
do $$
begin
  delete from auth.mfa_factors;
exception when others then
  raise notice 'Could not remove authenticator factors: %', sqlerrm;
end $$;
