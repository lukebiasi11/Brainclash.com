# Display-name retention plan

This plan is not enabled. Nothing in this repository applies the migration to the hosted project, sets a database password, schedules the job, or turns the public board on.

`private.retain_board_names()` clears `display_name` on `private.board_post` rows whose `posted_at` is older than 90 days and deletes `private.board_rate` rows older than 7 days. `private.board_agg` stays. The function does not read or write field score rows.

The function is granted to `board_retention` only. It is not granted to `board_runtime`, `field_runtime`, `app_writer`, `anon`, or `authenticated`. The Edge function does not call it. This repository does not enable `pg_cron` and does not create a schedule.

`.github/workflows/retain-board-names.yml` is present and disabled (`if: false`, no schedule). It is not executed by this repository.

When an operator later enables it, the only statement is:

```sql
select private.retain_board_names();
```
