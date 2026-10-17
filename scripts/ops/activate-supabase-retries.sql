-- Separate production approval and credential setup required. Does not reveal the secret.
begin;
do $$
declare retry_job bigint;
begin
  if (select count(*) from vault.decrypted_secrets
      where name = 'valtoris_retry_cron_secret' and length(decrypted_secret) >= 16) <> 1
  then raise exception 'configure_matching_cron_secret_in_vault_first'; end if;
  select jobid into strict retry_job from cron.job
    where jobname = 'valtoris-lead-retries'
      and schedule = '*/5 * * * *'
      and command = 'select valtoris_ops.run_retry_worker();'
      and username = current_user;
  perform cron.alter_job(retry_job, active := true);
end;
$$;
commit;
