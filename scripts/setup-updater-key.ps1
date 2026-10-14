# The update signing key, once (docs/DEVELOPMENT.md, "מפתח העדכונים").
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-updater-key.ps1
#
# 1. Uses the key at $HOME\.tauri\management.key — moving it there first if an
#    earlier `npx tauri signer generate -w ~/...` left it in a folder named "~"
#    inside the project — or creates one.
# 2. Asks for its password and checks it by signing a scratch file.
# 3. Saves the private key and the password as GitHub secrets, and the public
#    key as the variable UPDATER_PUBKEY, for .github/workflows/release.yml.
#
# The key and the password never leave this computer except to GitHub.

param([string]$KeyPath = (Join-Path $HOME ".tauri\management.key"))

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "   $text" -ForegroundColor Green }

Step "GitHub"
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "gh לא מחובר. הריצו קודם: gh auth login" }
$repo = gh repo view --json nameWithOwner --jq .nameWithOwner
if (-not $repo) { throw "לא נמצא מאגר GitHub לתיקייה הזו" }
Ok "המאגר: $repo"

Step "המפתח"
# A folder literally named "~" inside the project, from a path PowerShell
# didn't expand. Only that folder, and only inside the project.
$stray = Join-Path $root "~"
if (Test-Path -LiteralPath $stray) {
  $strayKey = Join-Path $stray ".tauri\management.key"
  if (Test-Path -LiteralPath $strayKey) {
    if (Test-Path -LiteralPath $KeyPath) {
      throw "יש מפתח גם ב-$KeyPath וגם בתוך הפרויקט ($strayKey). החליטו איזה מהם, ומחקו או העבירו את השני ידנית."
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
    Move-Item -LiteralPath $strayKey, "$strayKey.pub" -Destination (Split-Path $KeyPath)
    Ok "המפתח הועבר מתוך הפרויקט אל $(Split-Path $KeyPath)"
  }
  if (Get-ChildItem -LiteralPath $stray -Recurse -File -Force) {
    Write-Host "   בתיקייה $stray נשארו קבצים — לא נמחקה. בדקו אותה ידנית." -ForegroundColor Yellow
  } else {
    Remove-Item -LiteralPath $stray -Recurse -Force
    Ok "התיקייה הריקה ~ נמחקה מהפרויקט"
  }
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
  Write-Host "   אין מפתח — יוצרים חדש. הסיסמה לא מוצגת בזמן ההקלדה; מקלידים ולוחצים Enter, פעמיים."
  New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
  npx tauri signer generate -w $KeyPath
  if ($LASTEXITCODE -ne 0) { throw "יצירת המפתח נכשלה" }
}
if (-not (Test-Path -LiteralPath "$KeyPath.pub")) { throw "חסר המפתח הציבורי $KeyPath.pub" }
Ok "המפתח: $KeyPath"

Step "הסיסמה"
$secure = Read-Host "   הסיסמה של המפתח (לא תוצג; ריק אם יצרתם בלי סיסמה)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# Signing a scratch file proves the key and the password belong together.
# (Not without a password: PowerShell can't hand the CLI an empty one, and it
# would wait for it at a prompt.)
$signed = $true
if ($password) {
  $probe = New-TemporaryFile
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $password
  try {
    npx tauri signer sign -f $KeyPath $probe.FullName *> $null
    $signed = $LASTEXITCODE -eq 0
  } finally {
    Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $probe.FullName, "$($probe.FullName).sig" -Force -ErrorAction SilentlyContinue
  }
}
if (-not $signed) { throw "הסיסמה לא מתאימה למפתח. הריצו שוב." }
Ok ($(if ($password) { "הסיסמה מתאימה למפתח" } else { "בלי סיסמה" }))

Step "שמירה ב-GitHub"
Get-Content -LiteralPath $KeyPath -Raw | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $repo
if ($LASTEXITCODE -ne 0) { throw "שמירת המפתח נכשלה" }
if ($password) {
  $password | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $repo
  if ($LASTEXITCODE -ne 0) { throw "שמירת הסיסמה נכשלה" }
} else {
  Ok "בלי סיסמה — הסוד TAURI_SIGNING_PRIVATE_KEY_PASSWORD לא נדרש"
}
Get-Content -LiteralPath "$KeyPath.pub" -Raw | gh variable set UPDATER_PUBKEY --repo $repo
if ($LASTEXITCODE -ne 0) { throw "שמירת המפתח הציבורי נכשלה" }
$password = $null

Step "מה שמור עכשיו ב-$repo"
gh secret list --repo $repo
gh variable list --repo $repo

Write-Host "`nמוכן. שמרו את $KeyPath ואת הסיסמה גם במקום בטוח מחוץ למחשב —" -ForegroundColor Green
Write-Host "בלעדיהם אי אפשר לחתום עדכון, וההתקנות הקיימות לא יקבלו עוד עדכונים." -ForegroundColor Green
