# The update signing key (docs/DEVELOPMENT.md, "מפתח העדכונים").
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-updater-key.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-updater-key.ps1 -New
#
# 1. Uses the key at $HOME\.tauri\management.key — moving it there first if an
#    earlier `npx tauri signer generate -w ~/...` left it in a folder named "~"
#    inside the project. -New (or no key at all) creates one; an existing key
#    is kept beside it as management.key.old-<date>, never deleted.
# 2. Asks for the password with stars on screen, and checks it against the key
#    by signing a scratch file — an empty password too.
# 3. Saves the private key and the password as GitHub secrets, and the public
#    key as the variable UPDATER_PUBKEY, for .github/workflows/release.yml.
#
# The key and the password never leave this computer except to GitHub.

param(
  [string]$KeyPath = (Join-Path $HOME ".tauri\management.key"),
  [switch]$New
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "   $text" -ForegroundColor Green }

# Read-Host -AsSecureString shows a star per character, so it is clear that
# something was typed. Returns plain text for the CLI and gh.
function Read-Password($prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

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

if ($New -and (Test-Path -LiteralPath $KeyPath)) {
  $stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
  Move-Item -LiteralPath $KeyPath -Destination "$KeyPath.old-$stamp"
  if (Test-Path -LiteralPath "$KeyPath.pub") { Move-Item -LiteralPath "$KeyPath.pub" -Destination "$KeyPath.pub.old-$stamp" }
  Ok "המפתח הקודם נשמר בצד: $KeyPath.old-$stamp"
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
  Write-Host "   יוצרים מפתח חדש. בחרו סיסמה (כוכביות על המסך), או Enter לבלי סיסמה."
  $first = Read-Password "   סיסמה למפתח החדש"
  $second = Read-Password "   שוב, לאישור"
  if ($first -ne $second) { throw "הסיסמאות לא זהות. הריצו שוב." }
  New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
  # --password=<value> rather than -p <value>: Windows PowerShell drops an
  # empty argument, and the CLI would then stop to ask.
  npx tauri signer generate -w $KeyPath --ci "--password=$first" *> $null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $KeyPath)) { throw "יצירת המפתח נכשלה" }
  $password = $first
  Ok "נוצר מפתח חדש: $KeyPath"
} else {
  Ok "המפתח: $KeyPath"
  $password = Read-Password "   הסיסמה של המפתח (כוכביות על המסך; Enter אם אין)"
}
if (-not (Test-Path -LiteralPath "$KeyPath.pub")) { throw "חסר המפתח הציבורי $KeyPath.pub" }

Step "בדיקת הסיסמה"
# Signing a scratch file proves the key and the password belong together.
$probe = New-TemporaryFile
try {
  npx tauri signer sign -f $KeyPath "--password=$password" $probe.FullName *> $null
  $signed = $LASTEXITCODE -eq 0
} finally {
  Remove-Item -LiteralPath $probe.FullName, "$($probe.FullName).sig" -Force -ErrorAction SilentlyContinue
}
if (-not $signed) {
  throw "הסיסמה לא מתאימה למפתח. אם היא לא ידועה — הריצו עם -New ליצירת מפתח חדש (כל עוד לא פורסמה גרסה חתומה, זה לא פוגע באף אחד)."
}
Ok ($(if ($password) { "הסיסמה מתאימה למפתח" } else { "המפתח בלי סיסמה — אומת" }))

Step "שמירה ב-GitHub"
Get-Content -LiteralPath $KeyPath -Raw | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $repo
if ($LASTEXITCODE -ne 0) { throw "שמירת המפתח נכשלה" }
if ($password) {
  $password | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $repo
  if ($LASTEXITCODE -ne 0) { throw "שמירת הסיסמה נכשלה" }
} else {
  # A password secret left from an earlier key would now be wrong.
  gh secret delete TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $repo *> $null
  Ok "בלי סיסמה — אין סוד סיסמה"
}
Get-Content -LiteralPath "$KeyPath.pub" -Raw | gh variable set UPDATER_PUBKEY --repo $repo
if ($LASTEXITCODE -ne 0) { throw "שמירת המפתח הציבורי נכשלה" }
$password = $null; $first = $null; $second = $null

Step "מה שמור עכשיו ב-$repo"
gh secret list --repo $repo
gh variable list --repo $repo

Write-Host "`nמוכן. שמרו את $KeyPath ואת הסיסמה גם במקום בטוח מחוץ למחשב —" -ForegroundColor Green
Write-Host "בלעדיהם אי אפשר לחתום עדכון, וההתקנות הקיימות לא יקבלו עוד עדכונים." -ForegroundColor Green
