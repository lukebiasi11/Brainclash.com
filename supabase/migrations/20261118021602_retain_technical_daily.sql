-- Daily caller for the existing private.retain_technical().
-- Does not replace that function and does not change what it deletes.
-- Does not install pg_cron and does not create a database schedule.
-- Hosted migrations run as a non-superuser, so this file does not name
-- SUPERUSER, REPLICATION, or BYPASSRLS.
-- retention_job has no password here. An operator sets it outside this
-- repository. The GitHub Action is the only scheduled caller.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'retention_job') then
    create role retention_job login noinherit;
  end if;
end $$;

alter role retention_job login noinherit connection limit 2;
alter role retention_job set search_path = '';
alter role retention_job set statement_timeout = '30s';

revoke all on function private.retain_technical() from public, anon, authenticated, app_writer, field_runtime;
revoke all on schema private from retention_job;
revoke all on all tables in schema private from retention_job;
revoke all on all functions in schema private from retention_job;
grant usage on schema private to retention_job;
grant execute on function private.retain_technical() to retention_job;
