# Staging retention plan

This plan is not enabled. Nothing in this repository creates a hosted project, sets a database password, schedules a job, or turns collection on.

## Login

`field_runtime` is the only login the Edge entry accepts. The migration creates it with no password. `FIELD_DB_URL` must connect as that role. The entry reads `session_user` and then runs `set role app_writer` for one transaction. A superuser URL or a service-role URL fails closed.

The password, when a staging database exists, is set by an operator outside this repository. It is not committed and it is not an environment example file.

`field_runtime` does not inherit `app_writer`. It cannot read `operator_contact`, and it cannot execute `private.deletion_request` or `private.retain_technical`.

## Retention

`private.retain_technical()` deletes only `technical_event` and `rate_window` rows older than 7 days. Score rows, dedup rows, and day aggregates stay.

The function is not granted to `field_runtime`, `app_writer`, `anon`, or `authenticated`. The Edge function does not call it. This repository does not enable `pg_cron` and does not create a schedule.

When a staging database exists, the migration owner — not the Edge login — may run this once a day:

```sql
select private.retain_technical();
```

That statement is not executed by this repository. A hosted scheduler is a later operator step, not part of this change.
