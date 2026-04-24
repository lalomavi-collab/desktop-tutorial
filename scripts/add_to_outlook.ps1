# ============================================================
#  add_to_outlook.ps1 – Spain PhD Trip → Outlook Calendar
#  הרץ מהמחשב שלך: .\add_to_outlook.ps1
# ============================================================

$ClientId    = "46ef29bb-52cc-4759-9b6e-c22c3a102aca"
$RedirectUri = "https://login.microsoftonline.com/common/oauth2/nativeclient"
$Authority   = "https://login.microsoftonline.com/consumers/oauth2/v2.0"
$Scope       = "https://graph.microsoft.com/Calendars.ReadWrite offline_access openid"
$GraphUrl    = "https://graph.microsoft.com/v1.0/me/events"

# ── אימות ──────────────────────────────────────────────────
$EncRedirect = [Uri]::EscapeDataString($RedirectUri)
$EncScope    = [Uri]::EscapeDataString($Scope)
$AuthUrl     = "$Authority/authorize?client_id=$ClientId&response_type=code" +
               "&redirect_uri=$EncRedirect&scope=$EncScope&response_mode=query"

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  שלב 1 – פותח דפדפן לאימות Microsoft" -ForegroundColor Yellow
Write-Host "  שלב 2 – היכנס עם חשבון Outlook שלך" -ForegroundColor Yellow
Write-Host "  שלב 3 – העתק את ה-URL המלא מסרגל הכתובת" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Start-Process $AuthUrl
$CallbackUrl = Read-Host "► הדבק את ה-URL"

# ── חילוץ auth code ─────────────────────────────────────────
$QueryString = ([Uri]$CallbackUrl).Query.TrimStart('?')
$Params = @{}
foreach ($part in $QueryString.Split('&')) {
    $kv = $part.Split('=', 2)
    if ($kv.Length -eq 2) { $Params[$kv[0]] = [Uri]::UnescapeDataString($kv[1].Replace('+', ' ')) }
}
$Code = $Params["code"]
if (-not $Code) { Write-Host "❌ לא נמצא קוד ב-URL. נסה שוב." -ForegroundColor Red; exit 1 }

# ── החלפת code לטוקן ────────────────────────────────────────
$TokenBody = "client_id=$ClientId&code=$([Uri]::EscapeDataString($Code))" +
             "&redirect_uri=$EncRedirect&grant_type=authorization_code&scope=$EncScope"
try {
    $TokenResp  = Invoke-RestMethod -Method POST -Uri "$Authority/token" `
                  -ContentType "application/x-www-form-urlencoded" -Body $TokenBody
    $Token      = $TokenResp.access_token
} catch {
    Write-Host "❌ שגיאת אימות: $_" -ForegroundColor Red; exit 1
}

Write-Host ""
Write-Host "✅ אימות הצליח! מוסיף אירועים ל-Outlook..." -ForegroundColor Green
Write-Host ""

$Headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }

# ── רשימת האירועים ──────────────────────────────────────────
$Events = @(
    @{
        subject  = "✈️ Flight to Madrid – EL AL LY395"
        body     = @{ contentType = "Text"; content = "Flight: EL AL LY395`nDeparture from Ben Gurion Airport" }
        start    = @{ dateTime = "2026-05-25T17:00:00"; timeZone = "Israel Standard Time" }
        end      = @{ dateTime = "2026-05-25T22:10:00"; timeZone = "Romance Standard Time" }
        location = @{ displayName = "TLV → MAD" }
    },
    @{
        subject   = "🏨 NH Madrid Barajas Airport"
        body      = @{ contentType = "Text"; content = "Hotel accommodation – arrival night" }
        isAllDay  = $true
        start     = @{ dateTime = "2026-05-25T00:00:00"; timeZone = "UTC" }
        end       = @{ dateTime = "2026-05-26T00:00:00"; timeZone = "UTC" }
        location  = @{ displayName = "Madrid, Spain" }
    },
    @{
        subject  = "🚂 Train to Córdoba – AVE 2080"
        body     = @{ contentType = "Text"; content = "High-speed AVE train`nMadrid Atocha → Córdoba" }
        start    = @{ dateTime = "2026-05-26T08:00:00"; timeZone = "Romance Standard Time" }
        end      = @{ dateTime = "2026-05-26T10:30:00"; timeZone = "Romance Standard Time" }
        location = @{ displayName = "Madrid → Córdoba" }
    },
    @{
        subject   = "🏨 NH Córdoba Califa"
        body      = @{ contentType = "Text"; content = "Hotel accommodation – 2 nights (26–28 May)" }
        isAllDay  = $true
        start     = @{ dateTime = "2026-05-26T00:00:00"; timeZone = "UTC" }
        end       = @{ dateTime = "2026-05-28T00:00:00"; timeZone = "UTC" }
        location  = @{ displayName = "Córdoba, Spain" }
    },
    @{
        subject  = "📚 PhD Defense – Final Preparation"
        body     = @{ contentType = "Text"; content = "Final preparation before doctoral defense`nUniversidad de Córdoba" }
        start    = @{ dateTime = "2026-05-27T08:00:00"; timeZone = "Romance Standard Time" }
        end      = @{ dateTime = "2026-05-27T10:00:00"; timeZone = "Romance Standard Time" }
        location = @{ displayName = "Universidad de Córdoba" }
    },
    @{
        subject    = "🎓 PhD DEFENSE 🔒"
        body       = @{ contentType = "Text"; content = "DOCTORAL DEFENSE EXAM`nCRITICAL EVENT – Closed session" }
        start      = @{ dateTime = "2026-05-27T10:00:00"; timeZone = "Romance Standard Time" }
        end        = @{ dateTime = "2026-05-27T11:00:00"; timeZone = "Romance Standard Time" }
        location   = @{ displayName = "Universidad de Córdoba" }
        importance = "high"
    },
    @{
        subject  = "🎉 Post-Defense Celebration"
        body     = @{ contentType = "Text"; content = "Celebration following successful PhD defense" }
        start    = @{ dateTime = "2026-05-27T12:00:00"; timeZone = "Romance Standard Time" }
        end      = @{ dateTime = "2026-05-27T15:00:00"; timeZone = "Romance Standard Time" }
        location = @{ displayName = "Córdoba, Spain" }
    },
    @{
        subject  = "🚂 Train back to Madrid – AVE"
        body     = @{ contentType = "Text"; content = "Return journey to Madrid by high-speed AVE train" }
        start    = @{ dateTime = "2026-05-28T13:50:00"; timeZone = "Romance Standard Time" }
        end      = @{ dateTime = "2026-05-28T15:35:00"; timeZone = "Romance Standard Time" }
        location = @{ displayName = "Córdoba → Madrid" }
    },
    @{
        subject  = "🍽️ Dinner in Madrid"
        body     = @{ contentType = "Text"; content = "Dinner celebration in Madrid before return flight" }
        start    = @{ dateTime = "2026-05-28T16:00:00"; timeZone = "Romance Standard Time" }
        end      = @{ dateTime = "2026-05-28T20:30:00"; timeZone = "Romance Standard Time" }
        location = @{ displayName = "Madrid, Spain" }
    },
    @{
        subject  = "✈️ Flight home – EL AL LY396"
        body     = @{ contentType = "Text"; content = "Return flight to Ben Gurion Airport`nFlight: EL AL LY396`nArrives May 29" }
        start    = @{ dateTime = "2026-05-28T22:45:00"; timeZone = "Romance Standard Time" }
        end      = @{ dateTime = "2026-05-29T05:15:00"; timeZone = "Israel Standard Time" }
        location = @{ displayName = "MAD → TLV" }
    }
)

# ── יצירת האירועים ──────────────────────────────────────────
$ok = 0
for ($i = 0; $i -lt $Events.Count; $i++) {
    $event = $Events[$i]
    $num   = $i + 1
    $body  = $event | ConvertTo-Json -Depth 10 -Compress
    try {
        Invoke-RestMethod -Method POST -Uri $GraphUrl -Headers $Headers -Body $body | Out-Null
        Write-Host "✅ $num/10  $($event.subject)" -ForegroundColor Green
        $ok++
    } catch {
        $msg = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        Write-Host "❌ $num/10  $($event.subject) – $($msg.error.message)" -ForegroundColor Red
    }
}

Write-Host ""
if ($ok -eq 10) {
    Write-Host "🎉 סיום! כל 10 האירועים נוספו ל-Outlook Calendar." -ForegroundColor Green
} else {
    Write-Host "⚠️  $ok/10 אירועים נוספו." -ForegroundColor Yellow
}
