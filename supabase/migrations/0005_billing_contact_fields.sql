-- 0005_billing_contact_fields.sql
-- Invoice4U clearing requires a payer FullName + Phone. Store them on the
-- milestone so a hosted payment page can be created from it (from a call's
-- quick-charge, which has the caller's number, or from the admin billing form).
alter table public.billing_milestones
  add column if not exists client_name text,
  add column if not exists client_phone text;
