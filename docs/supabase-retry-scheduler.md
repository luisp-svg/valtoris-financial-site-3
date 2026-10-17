# Optional Supabase retry scheduler

Keep Vercel Hobby and the existing daily Vercel job. Supabase can check the existing delivery queue every five minutes and call the existing authenticated worker only when a consented, non-deleted lead has a due pending delivery or stale claim. It does not reopen held rows or enqueue historical leads. The worker retains its consent checks, identity verification, leases, five-item cap and 45-second deadline. It handles Report Cards and the existing insurance-quote queue. Phone remains mandatory; no form changes are included.

## Review and preparation

The production project is `phanoknohbidqtgrpwvk`. Run `scripts/ops/prepare-supabase-retries.sql` only after production review. It adds pg_cron, the synchronous HTTP extension and a private security-invoker function, then creates `valtoris-lead-retries` INACTIVE inside one transaction. A pre-existing job with that name causes an error rather than overwriting it. These are optional operations scripts, not automatic application migrations or deployment hooks.

Synchronous HTTP avoids copying the bearer credential into pg_net's request queue, which Supabase documents as readable to database-connected roles. The call holds no delivery row locks and times out after 55 seconds, with a five-second connection timeout. Each run uses a database connection while waiting. No additional subscription is purchased, but existing database/function usage limits still apply.

## Credential setup — account owner

Use the existing production Vercel `CRON_SECRET` value and store the identical value in Supabase Vault under `valtoris_retry_cron_secret`. Enter credentials directly in the providers; do not put values in chat, Git, SQL files or logs. Never use the AgentCRM token or Supabase service-role key as this credential. If the existing value is not available to the owner, coordinate a dedicated secret rotation in Vercel and Vault and a production redeployment; do not try to reveal or copy a hidden production secret automatically.

The preparation file contains no credential value. Activation refuses to proceed unless the expected Vault secret exists with at least 16 characters. The private function is not granted to public, anon or authenticated roles. Requests use one fixed HTTPS URL and never carry client answers or identity fields. Cron logs receive only a controlled outcome or generic failure, not response bodies or authorization headers.

## Activation and verification

After review, inspect counts by delivery kind/status, confirm the secret matches Vercel, and run `scripts/ops/activate-supabase-retries.sql`. It verifies the job's exact command, owner and five-minute schedule before enabling it. Confirm the job is active, then observe a controlled approved QA delivery reaching synced/verified with the intended task owner and no duplicate records. A successful cron SQL run is not by itself proof that a lead was delivered; inspect the delivery checkpoint as well. Do not print Vault values or raw HTTP headers.

The existing daily Vercel job remains a fallback. Worker lease fencing handles overlapping calls. Checks every five minutes do not guarantee delivery in five minutes: retry due times, provider failures, the five-item cap and backlog affect timing. Investigate repeated failures and held deliveries rather than resetting their safety flags.

Pause with `scripts/ops/pause-supabase-retries.sql`; this disables only the named job and does not change leads, task checkpoints, credentials or the daily Vercel job.

## Validation so far

The preparation SQL executed in a transaction against valtoris-crm-dev, verified inactive scheduling, no public-user execute permission and security-invoker behavior, and rolled back all DDL. No network call or production installation occurred. Credential matching and scheduled live delivery remain unverified until setup and approval.

Sources: https://supabase.com/docs/guides/cron/quickstart , https://supabase.com/docs/guides/database/extensions/http , https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357 .
