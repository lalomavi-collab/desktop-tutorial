#!/usr/bin/env bash
# Tests for scripts/offsite-backup on Linux or macOS, with pwsh 7 and rclone 1.60 or later:
#   bash scripts/offsite-backup/tests/run-tests.sh
# Copies the three files to a temp dir and swaps only the credential reader for one that reads
# TEST_CRED_* environment variables; everything else is the production code. Supabase is replaced
# by a local folder (-SourceRemote) and OneDrive by a temp folder, so nothing leaves this machine.
# Windows-only parts (Credential Manager, the scheduled task, the toast) are not covered.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T=$(mktemp -d "${TMPDIR:-/tmp}/offsite-test.XXXX")
echo "work dir: $T"
mkdir -p "$T/code" "$T/src" "$T/home"
cp "$REPO"/*.ps1 "$REPO"/*.psm1 "$T/code/"
python3 - "$T/code/LalumOffsite.psm1" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a=s.index('$script:CredentialReader = {'); b=s.index('\nfunction Get-LalumSecret')
stub='''$script:CredentialReader = {
    param([string]$Target)
    $v = [Environment]::GetEnvironmentVariable('TEST_CRED_' + ($Target -replace '-', '_').ToUpperInvariant())
    if (-not $v) { return $null }
    $parts = $v -split '\\|', 2
    return [pscustomobject]@{ User = $parts[0]; Secret = $parts[1] }
}
'''
open(p,'w',encoding='utf-8').write(s[:a]+stub+s[b:])
PY
# Dummy test passwords, used only inside the temp dir.
PW='Correct-Horse-Battery-Staple-42!'
SALT='Another#Long$Salt*Value_2026x'
export TEST_CRED_LALUM_OFFSITE_CRYPT="crypt|$PW"
export TEST_CRED_LALUM_OFFSITE_CRYPT_SALT="crypt|$SALT"
export HOME="$T/home"
DEST="$T/onedrive/LALUM offsite backup"
mkdir -p "$T/onedrive"
# Source: three buckets like production, plus an empty one, nested paths, a space and a Hebrew name.
mkdir -p "$T/src/matter-originals/firm-1/L-2026-0018/docs" "$T/src/finance-archive-backup/2026" "$T/src/client-files/c1" "$T/src/empty-bucket"
for i in $(seq 1 25); do head -c $((RANDOM*7+100)) /dev/urandom > "$T/src/matter-originals/firm-1/L-2026-0018/docs/original-$i.pdf"; done
for i in $(seq 1 12); do head -c $((RANDOM+50)) /dev/urandom > "$T/src/finance-archive-backup/2026/inv $i.pdf"; done
echo "hello" > "$T/src/client-files/c1/ייפוי כוח.txt"
head -c 3000000 /dev/urandom > "$T/src/client-files/c1/big scan.pdf"
pass=0; fail=0
check() { if [ "$1" = "$2" ]; then echo "PASS $3"; pass=$((pass+1)); else echo "FAIL $3 (got $1, want $2)"; fail=$((fail+1)); fi; }
B() { pwsh -NoProfile -File "$T/code/Backup-LalumStorage.ps1" -SourceRemote "$T/src" -Destination "$DEST" "$@"; }
R() { pwsh -NoProfile -File "$T/code/Restore-LalumStorage.ps1" -Destination "$DEST" "$@"; }

echo "== T1 dry run"; B -DryRun > "$T/t1.out" 2>&1; check $? 0 "dry run exits 0"
[ -e "$DEST" ] && check exists absent "dry run wrote nothing" || check absent absent "dry run wrote nothing"
grep -q "matter-originals: 25 files" "$T/t1.out"; check $? 0 "dry run lists bucket counts"

echo "== T2 backup"; B > "$T/t2.out" 2>&1; rc=$?; check $rc 0 "backup exits 0"; [ $rc -ne 0 ] && cat "$T/t2.out"
grep -q "copied and verified" "$T/t2.out"; check $? 0 "buckets verified"
grep -q "empty-bucket: empty" "$T/t2.out"; check $? 0 "empty bucket handled"
names=$(cd "$DEST" && find . | grep -c -E "matter|finance|client|snapshots|original|inv |manifest|summary")
check "$names" 0 "no plaintext names at the destination"
grep -rqF "$PW" "$T/home" "$DEST"; check $? 1 "crypt password not in logs or destination"
grep -rqF "$SALT" "$T/home" "$DEST"; check $? 1 "salt not in logs or destination"
grep -q '"result":"ok"' "$T/home/.local/share/LalumBackup/history.jsonl"; check $? 0 "history has ok entry"
grep -q "First snapshot" "$T/t2.out"; check $? 0 "first run reminder"
maxlen=$(cd "$DEST" && find . | awk '{ if (length($0)>m) m=length($0) } END { print m }'); echo "   longest encrypted path: $maxlen chars"

echo "== T3 list"; R -List > "$T/t3.out" 2>&1; check $? 0 "list exits 0"; cat "$T/t3.out" | grep -E "^[0-9]{4}" 
grep -qE "ok +39 files" "$T/t3.out"; check $? 0 "list shows ok and 39 files"

echo "== T4 restore"; R -Snapshot latest -To "$T/restore" > "$T/t4.out" 2>&1; rc=$?; check $rc 0 "restore exits 0"; [ $rc -ne 0 ] && cat "$T/t4.out"
diff -r "$T/src/matter-originals" "$T/restore/matter-originals" && diff -r "$T/src/finance-archive-backup" "$T/restore/finance-archive-backup" && diff -r "$T/src/client-files" "$T/restore/client-files"; check $? 0 "restored files identical to source"
[ -f "$T/restore/client-files/c1/ייפוי כוח.txt" ]; check $? 0 "Hebrew file name round trip"

echo "== T5 restore into non-empty folder"; R -Snapshot latest -To "$T/restore" > "$T/t5.out" 2>&1; check $? 1 "refuses non-empty folder"

echo "== T6 single bucket restore"; R -Snapshot latest -To "$T/restore2" -Bucket client-files > "$T/t6.out" 2>&1; check $? 0 "single bucket restore"
[ -d "$T/restore2/matter-originals" ]; check $? 1 "only the requested bucket restored"

echo "== T7 wrong password"; TEST_CRED_LALUM_OFFSITE_CRYPT="crypt|Wrong-Password-For-This-Backup-1" R -List > "$T/t7.out" 2>&1; check $? 1 "wrong password fails"
grep -q "No snapshots were found" "$T/t7.out"; check $? 0 "wrong password message"

echo "== T8 missing credential"; TEST_CRED_LALUM_OFFSITE_CRYPT_SALT="" B > "$T/t8.out" 2>&1; check $? 1 "missing credential fails"
grep -q "lalum-offsite-crypt-salt' was not found" "$T/t8.out"; check $? 0 "missing credential message"

echo "== T9 weak password rejected"; TEST_CRED_LALUM_OFFSITE_CRYPT="crypt|short" B -DryRun > "$T/t9.out" 2>&1; check $? 1 "short password rejected"

echo "== T10 shrink warning (second snapshot)"
mkdir -p "$T/src2"; cp -r "$T/src/." "$T/src2/"; rm -f "$T/src2/matter-originals/firm-1/L-2026-0018/docs/original-1"*.pdf "$T/src2/matter-originals/firm-1/L-2026-0018/docs/original-2"*.pdf
pwsh -NoProfile -File "$T/code/Backup-LalumStorage.ps1" -SourceRemote "$T/src2" -Destination "$DEST" > "$T/t10.out" 2>&1; rc=$?; check $rc 0 "second backup exits 0"; [ $rc -ne 0 ] && cat "$T/t10.out"
grep -q "matter-originals shrank from 25 to" "$T/t10.out"; check $? 0 "shrink warning raised"

echo "== T11 tamper detection"
find "$DEST" -type f -size +100k -print0 | xargs -0 -n1 python3 -c '
import sys
p=sys.argv[1]; b=bytearray(open(p,"rb").read()); b[len(b)//2]^=0xFF; open(p,"wb").write(b)
'
R -Snapshot latest -To "$T/restore3" > "$T/t11.out" 2>&1; check $? 1 "tampered snapshot fails restore"

echo "== T12 lock"
python3 - "$T/home/.local/share/LalumBackup/backup.lock" "$T" <<'PY' &
import fcntl, sys, time
f=open(sys.argv[1],'a'); fcntl.flock(f, fcntl.LOCK_EX); open(sys.argv[2]+'/locked','w').close(); time.sleep(20)
PY
for i in $(seq 1 50); do [ -f "$T/locked" ] && break; sleep 0.2; done
B -DryRun > "$T/t12.out" 2>&1; check $? 1 "second run refused while locked"
grep -q "already running" "$T/t12.out"; check $? 0 "lock message"
kill %1 2>/dev/null; wait 2>/dev/null

echo "== T13 parse and ASCII"
pwsh -NoProfile -Command '$bad=0; foreach ($f in Get-ChildItem '"$REPO"' -Include *.ps1,*.psm1 -Recurse) { $t=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName,[ref]$t,[ref]$e); if ($e.Count) { $bad++; $e | ForEach-Object { Write-Host "$($f.Name): $($_.Message)" } } }; exit $bad'; check $? 0 "PowerShell parser: no errors"
LC_ALL=C grep -nP '[^\x00-\x7F]' "$REPO"/*.ps1 "$REPO"/*.psm1 >/dev/null; check $? 1 "scripts are ASCII only"

echo; echo "passed $pass, failed $fail"; echo "logs: $T/home/.local/share/LalumBackup/logs"
[ "$fail" -eq 0 ]
