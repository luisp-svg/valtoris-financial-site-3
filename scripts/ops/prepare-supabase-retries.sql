-- Optional operations setup, not an application migration. Review before production.
-- Target: valtoris-crm-prod (phanoknohbidqtgrpwvk). Installs an INACTIVE job.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists http with schema extensions;
create schema if not exists valtoris_ops;
revoke all on schema valtoris_ops from public, anon, authenticated;

create or replace function valtoris_ops.run_retry_worker()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  retry_secret text;
  reply extensions.http_response;
  result jsonb;
begin
  -- Held rows require review and are deliberately excluded. Stale claims can recover.
  if not exists (
    select 1 from public.insurance_quote_deliveries q
    join public.leads l on l.id = q.lead_id
    where l.deleted_at is null and l.consent_snapshot->'contactPermission' = 'true'::jsonb
      and (q.status = 'pending' and q.next_attempt_at <= now()
        or q.status = 'processing' and q.claimed_at <= now() - interval '5 minutes')
  ) then return jsonb_build_object('status', 'idle'); end if;

  select decrypted_secret into strict retry_secret
    from vault.decrypted_secrets where name = 'valtoris_retry_cron_secret';
  if length(retry_secret) < 16 then raise exception 'retry_secret_missing'; end if;

  -- Synchronous HTTP avoids putting the credential in pg_net's readable request queue.
  -- At most one bounded call per tick; no row locks held over the network request.
  perform set_config('http.curlopt_timeout_ms', '55000', true);
  perform set_config('http.curlopt_connecttimeout_ms', '5000', true);
  reply := extensions.http((
    'GET', 'https://www.valtorisfinancial.com/api/insurance-quote',
    array[extensions.http_header('Authorization', 'Bearer ' || retry_secret)],
    null, null
  )::extensions.http_request);
  if reply.status <> 200 then raise exception 'retry_http_failure'; end if;
  result := reply.content::jsonb;
  if result->'ok' is distinct from 'true'::jsonb
    or jsonb_typeof(result->'processed') is distinct from 'number'
    or (result->>'processed')::numeric not between 0 and 5
  then raise exception 'retry_response_invalid'; end if;
  return jsonb_build_object('status', 'completed', 'processed', result->'processed');
exception when others then
  -- Never persist credentials, response bodies, or provider/customer data in cron logs.
  raise exception using message = 'valtoris_retry_worker_failed';
end;
$$;
revoke all on function valtoris_ops.run_retry_worker() from public, anon, authenticated;

do $$
declare retry_job bigint;
begin
  if exists(select 1 from cron.job where jobname = 'valtoris-lead-retries') then
    raise exception 'retry_job_already_exists_review_before_replacing';
  end if;
  retry_job := cron.schedule('valtoris-lead-retries', '*/5 * * * *',
    'select valtoris_ops.run_retry_worker();');
  perform cron.alter_job(retry_job, active := false);
end;
$$;
commit;
