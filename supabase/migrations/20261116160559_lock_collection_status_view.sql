-- anon and authenticated previously had full DML on this auto-updatable
-- security definer view, so the public key could flip collection_enabled
-- or delete the gate row. security_invoker stays false on purpose, because
-- anon must read the view without access to the private schema, so the
-- Supabase definer-view advisor warning is expected.

create or replace view public.collection_status as
select collection_enabled,
       operator_contact is not null as contact_configured,
       min_other_finishes is not null as threshold_configured
from private.field_gate
where id = 1
limit 1;
alter view public.collection_status set (security_invoker = false);
revoke all on public.collection_status from public, anon, authenticated;
grant select on public.collection_status to anon, authenticated;
