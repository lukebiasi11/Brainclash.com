# Staging retention plan

pg_cron is not enabled. Nothing in this repository creates a hosted project, sets a database password, or turns collection on.

## Login

`field_runtime` is the only login the Edge entry accepts. The migration creates it with no password. `FIELD_DB_URL` must connect as that role. The entry reads `session_user` and then runs `set role app_writer` for one transaction. A superuser URL or a service-role URL fails closed.

The password, when a staging database exists, is set by an operator outside this repository. It is not committed and it is not an environment example file.

`field_runtime` does not inherit `app_writer`. It cannot read `operator_contact`, and it cannot execute `private.deletion_request` or `private.retain_technical`.

## Retention

`private.retain_technical()` is unchanged. It deletes only `technical_event` rows whose `created_at` is older than 7 days and `rate_window` rows whose `window_start` is older than 7 days. It does not read or delete `attempts`, `runs`, `dedup`, or `day_agg`.

The function stays security definer with an empty `search_path`. Execute stays revoked from `public`, `anon`, `authenticated`, `field_runtime`, and `app_writer`. The Edge function does not call it.

`retention_job` is a login with no password in this repository. It does not inherit. It has usage on schema `private` and execute on `private.retain_technical()` only. It has no table privileges. An operator sets its password outside this repository when a hosted database exists. The password is not committed and it is not an environment example file.

## Schedule

No migration enables `pg_cron` or calls `cron.schedule`. The daily schedule is `.github/workflows/retain-technical.yml`. At 08:15 UTC, and when an operator runs the workflow by hand, it executes one statement:

```sql
select private.retain_technical();
```

That statement is not executed by this repository. GitHub runs it only after the workflow is on the default branch and the Actions secret `RETENTION_DB_URL` is set. That secret is the session-mode pooler URI for `retention_job` (port 5432, database `postgres`, TLS required). It is not a service-role key, not the `field_runtime` URL, and not the migration-owner URL. Until the secret exists, the workflow refuses to connect.
