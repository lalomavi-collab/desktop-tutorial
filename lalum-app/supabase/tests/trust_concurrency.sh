#!/usr/bin/env bash
# Two sessions withdraw from the same matter at the same time. The balance allows only one.
# With a plain SELECT SUM trigger both would pass. Usage: trust_concurrency.sh <psql args>, e.g.
#   trust_concurrency.sh -h /var/lib/pgtest -p 54329 -U postgres -d t
set -u
P=(psql "$@" -v ON_ERROR_STOP=1 -q -At)
F=$("${P[@]}" -c "insert into public.lalum_firms (firm_name, registration_no, primary_contact, email, phone, monthly_fee) values ('CC','9','x','cc'||gen_random_uuid()||'@x','1',0) returning id")
U=$("${P[@]}" -c "insert into auth.users (id,email) values (gen_random_uuid(),'cc'||gen_random_uuid()||'@x') returning id")
"${P[@]}" -c "insert into public.lalum_firm_members (firm_id,user_id,name,email,role) values ('$F','$U','CC','cc@x','FIRM_PARTNER')"
M=$("${P[@]}" -c "insert into public.lalum_cockpit_matters (firm_id,title) values ('$F','CC') returning id")
C=$("${P[@]}" -c "insert into public.lalum_fin_customers (firm_id,name) values ('$F','CC') returning id")
A=$("${P[@]}" -c "insert into public.lalum_trust_accounts (firm_id,bank_name,branch,account_number) values ('$F','B','1','1') returning id")
"${P[@]}" -c "insert into public.lalum_matter_fees (matter_id,firm_id,fin_customer_id,fee_model) values ('$M','$F','$C','hourly')"
"${P[@]}" -c "insert into public.lalum_trust_ledger (firm_id,trust_account_id,matter_id,customer_id,tx_type,amount,created_by) values ('$F','$A','$M','$C','DEPOSIT',1000,'$U')"
W="set request.jwt.claim.sub='$U'; set role authenticated; select public.lalum_trust_post('$M','$A','DISBURSEMENT_TO_THIRD_PARTY',700,'x','race');"
r1=$(mktemp); r2=$(mktemp)
( "${P[@]}" -c "$W" >"$r1" 2>&1; echo "rc=$?" >>"$r1" ) &
( "${P[@]}" -c "$W" >"$r2" 2>&1; echo "rc=$?" >>"$r2" ) &
wait
ok=$(grep -l "rc=0" "$r1" "$r2" | wc -l); bad=$(grep -l "TRUST_OVERDRAFT" "$r1" "$r2" | wc -l)
bal=$("${P[@]}" -c "select sum(amount) from public.lalum_trust_ledger where matter_id='$M'")
echo "succeeded=$ok rejected=$bad final_balance=$bal"
[ "$ok" = 1 ] && [ "$bad" = 1 ] && [ "$bal" = "300.00" ] && echo "CONCURRENCY OK" || { echo "CONCURRENCY FAILED"; cat "$r1" "$r2"; exit 1; }
