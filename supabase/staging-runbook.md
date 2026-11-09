# dailydose staging runbook

Project ref: `xhgrcbsshhpvmfwzjtmp` only. Region us-west-2. Do not touch any other project.

Luke approved this on Nov 9, 2026, at 1:35 PM Phoenix: install and test the score backend on dailydose with fake scores. The approval covers migrations, the `field-compare` deploy, staging config, synthetic HTTPS calls, and cleanup of those synthetic rows.

Not approved: real-player collection, any change to the public game or frontend, a paid plan, or merging PR 56.

This file does not contain a password, a connection string, a publishable key, or a user JWT. Generate the role password at runtime and keep it out of the repo, the PR, and chat logs.

Trivia Manager runs the hosted calls. The tools for this run are `apply_migration`, `execute_sql`, `deploy_edge_function`, `get_advisors`, and `get_logs`. Do not use them on any other ref.

## Local precondition

The same three suites were run on local PostgreSQL 17.11 (`Ubuntu 17.11-1.pgdg24.04+2`), the major version of this project. Earlier runs had used 16.15.

- `node tools/field-compare.pg.test.js`: all pass
- `node tools/field-http.test.js`: all pass
- `node tools/field-bundle.test.js`: all pass

No SQL change was required. Nothing in the migrations is specific to 16.

## Fixed synthetic values

Use only these tags. The live game must not be able to send them.

| Tag | Value |
| --- | --- |
| Synthetic origin | `https://synthetic.dailydose.invalid` |
| Synthetic day | `2099-01-01` |
| Synthetic run id | `11111111-1111-4111-8111-111111111111` |
| Random run id, same caller | `22222222-2222-4222-8222-222222222222` |
| Fake scores | `100, 200, 300, 400, 500` (total 1500, not a played game) |

Function URL prefix: `https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare`

Auth URL: `https://xhgrcbsshhpvmfwzjtmp.supabase.co/auth/v1/signup`

Do not call any Cloudflare host, worker, or the old field-stats URL. Every curl in this runbook uses the host above.

`$PUBLISHABLE_KEY` is the project publishable key from the dashboard API settings. It is not a user session. Do not commit it. `$ACCESS_TOKEN` and `$AUTH_UID` come from the signup response in step 6. Do not commit those either.

## 1. Apply the migrations, in order

`apply_migration` arguments: `project_id` `xhgrcbsshhpvmfwzjtmp`, `name` as below, `query` the full file contents with no edits. Wait for each one to succeed before the next.

| Order | `name` | File |
| --- | --- | --- |
| 1 | `field_compare` | `supabase/migrations/20261107032646_field_compare.sql` |
| 2 | `anonymous_identity_rate` | `supabase/migrations/20261108203140_anonymous_identity_rate.sql` |
| 3 | `own_exclusion_runtime` | `supabase/migrations/20261108205325_own_exclusion_runtime.sql` |

Expected: each call reports success. The second migration moves the gate into `private` and drops `public.field_gate`. The third ignores the client run id when choosing the caller's own finish and creates `field_runtime` with no password.

Then `execute_sql`:

```sql
select version();
select collection_enabled, contact_configured, threshold_configured
from public.collection_status;
select rolcanlogin, rolinherit, rolsuper
from pg_roles where rolname = 'field_runtime';
select pg_has_role('field_runtime', 'app_writer', 'member');
```

Expected:

- `version()` starts with `PostgreSQL 17`.
- The status row is `false, false, false`. Collection is off, no operator contact, and the other-game threshold is null.
- `field_runtime` is login, not superuser, and does not inherit. The migration sets only `LOGIN` and `NOINHERIT`. It does not name `SUPERUSER`, `REPLICATION`, or `BYPASSRLS`, because hosted `postgres` cannot change those. A new role defaults to none of them.
- Membership in `app_writer` is true. The migration role created `app_writer`, so on PostgreSQL 17 it has `ADMIN OPTION` and the `GRANT` succeeds.

`execute_sql` as `anon` must fail to read the contact:

```sql
set role anon;
select operator_contact from private.field_gate;
```

Expected: SQLSTATE `42501`. Do not add a policy or grant that makes this succeed.

## 2. Secrets and dashboard settings

Do this before the deploy. None of these values go in the repo.

### Role password — SQL, generated at runtime

Generate it in the operator's shell. Do not paste it into a file in this repository.

```sh
openssl rand -base64 24
```

`execute_sql`, with that value substituted only in the live call:

```sql
alter role field_runtime password '<generated at runtime>';
```

Expected: success. Do not `select` the password back. `pg_authid.rolpassword` is no longer null, and the cleartext exists only in the shell that generated it and in the Edge secret below.

### FIELD_DB_URL — dashboard only

Not an MCP secret tool on this run. In the dashboard, Edge Function secrets, set the name `FIELD_DB_URL`.

Build the value from the project's session-mode pooler URI (port 5432, not the transaction-mode port). Replace the user with `field_runtime.xhgrcbsshhpvmfwzjtmp` and the password with the value just generated. Database name `postgres`.

Expected: the secret list shows the name `FIELD_DB_URL` and not the value. A later function call that connects as `postgres` or the service role returns `{"ok":false,"error":"db_error"}` because `session_user` is not `field_runtime`.

### FIELD_COLLECTION — dashboard only

Set the secret `FIELD_COLLECTION` to `off`. The function treats every other value, including an empty string, as off.

Expected: the name is present. Step 7 then returns `collection_off` until step 9.

### Allowed origin — dashboard only

Set the secret `FIELD_ALLOWED_ORIGINS` to exactly:

```text
https://synthetic.dailydose.invalid
```

Do not include `https://lukebiasi11.github.io`. The public game sends that origin, and this allowlist is the one the live game cannot reach. One origin, no wildcard, no trailing slash.

Expected: a curl with `Origin: https://lukebiasi11.github.io` returns 403 `origin_denied`. A curl with the synthetic origin is allowed through to the next check.

### Anonymous sign-ins — dashboard only

Authentication, Providers or settings, allow anonymous sign-ins: on, for this test window only.

Leave the anonymous sign-in rate limit at 30 per hour per IP (`rate_limit_anonymous_users`).

The Auth guide says to turn on CAPTCHA before anonymous sign-ins, because each sign-in inserts an `auth.users` row. The curl in section 6 cannot complete a real CAPTCHA widget. For this window, leave CAPTCHA off and rely on that 30-per-hour limit. Section 10 turns anonymous sign-ins back off.

If Luke instead wants CAPTCHA on, stop before section 6. The dashboard providers are hCaptcha and Turnstile (`security_captcha_provider`). The secret stays in the dashboard. The signup body then also needs `gotrue_meta_security.captcha_token` with a token from that provider. Do not invent a token and do not commit one.

### What not to push

Do not run `supabase config push`. The repo `config.toml` is the local file: anonymous sign-ins stay false there, and pushing it would copy local site URLs onto the hosted project. `verify_jwt = false` for this function is passed to `deploy_edge_function` in step 3, not by a config push.

## 3. Deploy the function

`deploy_edge_function`:

| Argument | Value |
| --- | --- |
| `project_id` | `xhgrcbsshhpvmfwzjtmp` |
| `name` | `field-compare` |
| `entrypoint_path` | `index.ts` |
| `verify_jwt` | `false` |

`verify_jwt` false is the designed platform setting. It is not user auth. The function still requires `getClaims` to return an anonymous `authenticated` session. A publishable key must not pass that check.

`files`: four files. `name` is the path next to the entrypoint. `index.ts` imports `./handler.js`, and that ESM file imports `./field-api.js` and `./auth.js`. Do not prebundle them. `content` is the repo file with no edits.

| `files[].name` | Repo path |
| --- | --- |
| `index.ts` | `supabase/functions/field-compare/index.ts` |
| `handler.js` | `supabase/functions/field-compare/handler.js` |
| `field-api.js` | `supabase/functions/field-compare/field-api.js` |
| `auth.js` | `supabase/functions/field-compare/auth.js` |

Do not upload `supabase/field-api.js`, `package.json`, or `deno.json`. Those are local Node and Deno settings. `handler.d.ts` is typecheck-only and is not part of this payload. The four files above are already ESM. Hosted Deno loads them directly. Do not prebundle.

Expected: the function `field-compare` exists, its entrypoint is `index.ts`, and JWT verification at the platform is off. `get_logs` for this function may be empty until step 7.

## 4. Collection stays off for the first curls

`FIELD_COLLECTION` is `off` and `private.field_gate.collection_enabled` is false. These calls must not write a row.

Save the publishable key in the shell as `$PUBLISHABLE_KEY`. It is not committed.

### Origin

```sh
curl -sS -D - -o /tmp/bc-origin.txt -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/start' \
  -H 'Origin: https://lukebiasi11.github.io' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"runId":"11111111-1111-4111-8111-111111111111","day":"2099-01-01"}'
```

Expected: HTTP 403 and body `{"ok":false,"error":"origin_denied"}`.

### Body cap

```sh
python3 -c 'print("x"*3000, end="")' > /tmp/bc-big.json
curl -sS -D - -o /tmp/bc-big.txt -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/finish' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/bc-big.json
```

Expected: HTTP 413 and body `{"ok":false,"error":"body_too_large"}`. This is rejected from the byte size before the collection check.

### Collection off

```sh
curl -sS -D - -o /tmp/bc-off.txt -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/start' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"runId":"11111111-1111-4111-8111-111111111111","day":"2099-01-01"}'
```

Expected: HTTP 503 and body `{"ok":false,"error":"collection_off"}`.

`execute_sql`:

```sql
select count(*) from private.runs;
select count(*) from private.attempts;
```

Expected: both `0`.

`get_logs` for `field-compare`: the three calls above, and no other host.

## 5. Time-boxed collection on

Do this only after step 4 passed, and do not leave this section. The allowlist stays `https://synthetic.dailydose.invalid` only.

Dashboard: set the secret `FIELD_COLLECTION` to `on`.

`execute_sql`:

```sql
update private.field_gate
set collection_enabled = true
where id = 1
returning collection_enabled;
```

Expected: `true`. Secrets are read on the next request. No second deploy.

If any curl in step 6 fails closed (`db_error`, or a write that did not use the synthetic ids), stop and go to step 7 anyway so collection cannot stay on.

## 6. Synthetic score calls

### Anonymous JWT

```sh
curl -sS -D - -o /tmp/bc-signup.json -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/auth/v1/signup' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"data":{}}'
```

Expected: HTTP 200. The JSON user has `is_anonymous` true. `access_token` is present. Set `$ACCESS_TOKEN` to that access token and `$AUTH_UID` to that user id. If CAPTCHA was turned on, this returns an error instead; stop and use the token path in step 2 rather than disabling a control to force a pass.

### Publishable key is not a session

```sh
curl -sS -D - -o /tmp/bc-key.txt -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/start' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"runId":"11111111-1111-4111-8111-111111111111","day":"2099-01-01"}'
```

Expected: HTTP 401 and body `{"ok":false,"error":"identity_rejected"}`.

### Start, finish, and the idempotent replay

```sh
curl -sS -D - -o /tmp/bc-start.json -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/start' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"runId":"11111111-1111-4111-8111-111111111111","day":"2099-01-01"}'
```

Expected: HTTP 200 and body `{"ok":true,"idempotent":false}`.

```sh
curl -sS -D - -o /tmp/bc-finish.json -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/finish' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"runId":"11111111-1111-4111-8111-111111111111","day":"2099-01-01","scores":[100,200,300,400,500]}'
```

Expected: HTTP 200 and a body that contains `"ok":true`, `"idempotent":false`, `"total":1500`, `"bin":1`, and `"scores_are_client_reports":true`.

Repeat that same finish curl.

Expected: HTTP 200 and a body that contains `"ok":true`, `"idempotent":true`, and `"total":1500`.

### Own exclusion, including a random run id

```sh
curl -sS -D - -o /tmp/bc-day-honest.json \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/day?day=2099-01-01&runId=11111111-1111-4111-8111-111111111111' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```sh
curl -sS -D - -o /tmp/bc-day-random.json \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/day?day=2099-01-01&runId=22222222-2222-4222-8222-222222222222' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected for both: HTTP 200, and both bodies agree on `"comparison_available":false`, `"reason":"threshold_unresolved"`, `"own_included":true`, `"own_total":1500`, `"rest_finishes":0`, `"histogram":null`. The random id must not turn the caller's 1500 into another player's score. The threshold stays null, so the comparison stays closed. Do not set `min_other_finishes` and do not set `operator_contact`.

### Rate limit

Sign up a second anonymous user the same way as step 6. Call that token `$RATE_TOKEN`. Then send this GET 21 times:

```sh
curl -sS -o /tmp/bc-rate.txt -w '%{http_code}\n' \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/day?day=2099-01-01&runId=22222222-2222-4222-8222-222222222222' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $RATE_TOKEN"
```

Expected: the first 20 responses are HTTP 200. The 21st is HTTP 429 and body `{"ok":false,"error":"rate_limited"}`. That second user has no finish, so the 200 bodies have `"own_included":false`. They must not include the first user's scores. Stop at 21. Do not loop toward the global ceiling of 50.

`execute_sql`:

```sql
select run_id, day_key, total
from private.runs
where day_key = '2099-01-01';
```

Expected: one row, run id `11111111-1111-4111-8111-111111111111`, total 1500.

`get_logs` for `field-compare`: these synthetic calls only.

## 7. Turn collection off and prove it

Do this immediately after step 6, including when a curl in step 6 failed.

`execute_sql`:

```sql
update private.field_gate
set collection_enabled = false
where id = 1
returning collection_enabled;
```

Expected: `false`.

Dashboard: set the secret `FIELD_COLLECTION` back to `off`. Leave `FIELD_ALLOWED_ORIGINS` on the synthetic origin. Do not point it at the public site.

```sh
curl -sS -D - -o /tmp/bc-off-again.txt -X POST \
  'https://xhgrcbsshhpvmfwzjtmp.supabase.co/functions/v1/field-compare/start' \
  -H 'Origin: https://synthetic.dailydose.invalid' \
  -H "apikey: $PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"runId":"11111111-1111-4111-8111-111111111111","day":"2099-01-01"}'
```

Expected: HTTP 503 and body `{"ok":false,"error":"collection_off"}`.

`execute_sql`:

```sql
select collection_enabled, contact_configured, threshold_configured
from public.collection_status;
```

Expected: `false, false, false`.

## 8. Delete only the synthetic rows

`execute_sql`. `$AUTH_UID` and the second signup's user id are the only auth ids. Substitute those two uuids. Do not delete any other user, day, or run.

```sql
delete from private.technical_event
where run_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

delete from private.dedup
where run_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

delete from private.runs
where run_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

delete from private.attempts
where run_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

delete from private.day_agg
where day_key = '2099-01-01';

delete from private.rate_window
where bucket in (
  'uid:' || '<first auth uid>',
  'create:' || '<first auth uid>',
  'uid:' || '<second auth uid>',
  'create:' || '<second auth uid>'
);
```

If `select count(*) from private.runs` is then 0, also delete the technical counters this test incremented and nothing else:

```sql
delete from private.rate_window
where bucket in ('global', 'create-global');
```

Skip that second delete if any run row remains.

The anonymous auth users are not score rows. Remove only those two ids, and only while `is_anonymous` is true:

```sql
delete from auth.identities
where user_id in ('<first auth uid>', '<second auth uid>');

delete from auth.sessions
where user_id in ('<first auth uid>', '<second auth uid>');

delete from auth.users
where id in ('<first auth uid>', '<second auth uid>')
  and is_anonymous is true;
```

Expected checks:

```sql
select count(*) from private.runs where day_key = '2099-01-01';
select count(*) from private.day_agg where day_key = '2099-01-01';
select count(*) from private.dedup
where run_id = '11111111-1111-4111-8111-111111111111';
```

Expected: all `0`. Real score rows, dedup, and aggregates are not on a 7-day timer. `private.retain_technical()` is not part of this cleanup and is not scheduled.

## 9. Advisors and logs

`get_advisors` for security.

`get_advisors` for performance.

Expected: no finding that `anon` or `authenticated` can read `operator_contact`, and no finding that a public table is missing row-level security because of these migrations. Record any other finding and do not "fix" it by opening a grant or turning collection on.

`get_logs` for `field-compare`: the synthetic calls, then the final `collection_off`. No request from `https://lukebiasi11.github.io` during the collection-on window.

## 10. Return the project to rest

Dashboard: anonymous sign-ins off. Leave the 30-per-hour limit in place. Leave CAPTCHA off unless Luke turned it on, in which case leave that provider as he set it.

Dashboard: `FIELD_COLLECTION` remains `off`.

The function can stay deployed. It rejects the public origin and it rejects every request while collection is off. Removing it is a separate decision. Do not merge PR 56. Do not change the public game. Do not set `min_other_finishes` or `operator_contact`.
