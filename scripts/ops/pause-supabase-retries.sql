-- Pause only this job; leaves delivery state and credentials untouched.
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'valtoris-lead-retries' and username = current_user;
