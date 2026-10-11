-- Harden the matter child tables to the same per-role access as the matters
-- themselves. Migration 0014 scoped the matter list and documents to
-- lalum_can_view_matter(), but the three tables that take direct firm-scoped
-- writes (annexes, KYC records, signing requests) still let any firm member
-- with fresh MFA read and write every matter in the firm, including ones the
-- member is not assigned to. That is the same leak 0014 closed one level up:
-- an attorney could reach an unassigned matter's annexes, KYC overview and
-- signing requests through a direct API call even though the matter itself was
-- hidden from them. Each policy below keeps its existing firm, MFA and role
-- conditions and adds public.lalum_can_view_matter(matter_id), so admin sees
-- all, a partner sees their department, and an attorney sees only assigned
-- matters, for reads and writes alike.
--
-- The signing table's client-read policy (lalum_sig_client_read) is left
-- untouched: it is matched by the signer's email, not firm membership, so the
-- client still reads their own non-draft request through the portal.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_matter_child_access".

-- Document annexes.
alter policy lalum_doc_annexes_read on public.lalum_doc_annexes
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
alter policy lalum_doc_annexes_insert on public.lalum_doc_annexes
  with check ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
alter policy lalum_doc_annexes_update on public.lalum_doc_annexes
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id))
  with check ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
alter policy lalum_doc_annexes_delete on public.lalum_doc_annexes
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));

-- KYC records. Two read policies exist on the table; both are scoped.
alter policy lalum_kyc_read on public.lalum_kyc_records
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
alter policy lalum_kyc_records_read on public.lalum_kyc_records
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
alter policy lalum_kyc_insert on public.lalum_kyc_records
  with check ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));
alter policy lalum_kyc_update on public.lalum_kyc_records
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id))
  with check ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));

-- Signing requests. Firm policies keep their role gate and add the matter
-- scope; the delete policy keeps its DRAFT-only guard. The client-read policy
-- stays email-based and is intentionally not altered here.
alter policy lalum_sig_firm_read on public.lalum_signature_requests
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok())
         and ((select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']))
         and public.lalum_can_view_matter(matter_id));
alter policy lalum_sig_firm_insert on public.lalum_signature_requests
  with check ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok())
         and ((select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']))
         and public.lalum_can_view_matter(matter_id));
alter policy lalum_sig_firm_update on public.lalum_signature_requests
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok())
         and ((select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']))
         and public.lalum_can_view_matter(matter_id))
  with check ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok())
         and ((select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']))
         and public.lalum_can_view_matter(matter_id));
alter policy lalum_sig_firm_delete on public.lalum_signature_requests
  using ((firm_id = (select public.lalum_my_firm_id())) and (select public.lalum_mfa_ok())
         and ((select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']))
         and (status = 'DRAFT') and public.lalum_can_view_matter(matter_id));
