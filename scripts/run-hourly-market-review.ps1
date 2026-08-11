$ErrorActionPreference = "Stop"

$now = Get-Date
if ($now.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) { exit 0 }
if ($now.Hour -lt 7 -or $now.Hour -ge 17) { exit 0 }

$repoRoot = Split-Path -Parent $PSScriptRoot
$reportsDir = Join-Path $repoRoot "reports\hourly"
$promptPath = Join-Path $repoRoot "automation\hourly-market-review.md"
$timestamp = $now.ToString("yyyyMMdd-HHmmss")
$snapshotPath = Join-Path $reportsDir "snapshot-$timestamp.json"
$reportPath = Join-Path $reportsDir "review-$timestamp.md"
$runLogPath = Join-Path $reportsDir "runner.log"
$mutex = [Threading.Mutex]::new($false, "Local\WallStreetHustlerHourlyReview")

if (-not $mutex.WaitOne(0)) { exit 0 }

try {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null

    $errors = [Collections.Generic.List[string]]::new()
    $bars = $null
    $quotes = $null
    $cursor = (([int]$now.DayOfYear * 24 + $now.Hour) * 8)

    try {
        $bars = Invoke-RestMethod -Uri "https://wallstreethustler.com/api/bars?cursor=$cursor" -TimeoutSec 45
    } catch {
        $errors.Add("Bars request failed: $($_.Exception.Message)")
    }

    $symbols = @("SPY", "QQQ", "IWM", "AAPL", "MSFT", "NVDA", "AMD", "AMZN", "META", "TSLA", "NFLX", "GME", "CVNA", "UPST", "AI")
    if ($bars -and $bars.universe) { $symbols = @($bars.universe) }
    $symbolQuery = [Uri]::EscapeDataString(($symbols -join ","))

    try {
        $quotes = Invoke-RestMethod -Uri "https://wallstreethustler.com/api/quotes?symbols=$symbolQuery" -TimeoutSec 45
    } catch {
        $errors.Add("Quotes request failed: $($_.Exception.Message)")
    }

    [ordered]@{
        collectedAt = $now.ToUniversalTime().ToString("o")
        source = "https://wallstreethustler.com"
        cursor = $cursor
        bars = $bars
        quotes = $quotes
        errors = @($errors)
    } | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $snapshotPath -Encoding utf8

    $codex = Join-Path $env:APPDATA "npm\codex.ps1"
    if (-not (Test-Path -LiteralPath $codex)) {
        $codex = (Get-Command codex -ErrorAction Stop).Source
    }

    $prompt = Get-Content -LiteralPath $promptPath -Raw
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $codex exec --approve-for-me --ephemeral --color never -C $repoRoot -o $reportPath $prompt 2>&1 |
            Tee-Object -FilePath $runLogPath -Append | Out-Null
        $codexExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }

    if ($codexExitCode -ne 0) {
        throw "Codex review exited with code $codexExitCode"
    }
} catch {
    "$(Get-Date -Format o) ERROR $($_.Exception.Message)" | Add-Content -LiteralPath $runLogPath
    exit 1
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
