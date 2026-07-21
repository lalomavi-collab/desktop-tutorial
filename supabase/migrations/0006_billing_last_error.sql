-- 0006_billing_last_error.sql
-- Store the last clearing error (redacted, never the API key) on the milestone
-- so a failed Invoice4U attempt can be diagnosed without scraping edge logs.
alter table public.billing_milestones
  add column if not exists last_error text;
