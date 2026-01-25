# AxCouncil Session Startup Script (PowerShell for Windows)
# Checks agent state and provides smart recommendations

$StateFile = ".claude\agent-state.json"
$Now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Today = (Get-Date).ToString("yyyy-MM-dd")
$DayOfWeek = [int](Get-Date).DayOfWeek  # 0=Sunday, 1=Monday

function Get-DaysSince {
    param([string]$LastRun)

    if ([string]::IsNullOrEmpty($LastRun) -or $LastRun -eq "null") {
        return "never"
    }

    try {
        $lastDate = [DateTime]::Parse($LastRun)
        $diff = ((Get-Date) - $lastDate).Days
        return $diff.ToString()
    } catch {
        return "never"
    }
}

Write-Host ""
Write-Host "+==============================================================+" -ForegroundColor Cyan
Write-Host "|           AxCouncil Session Started                          |" -ForegroundColor Cyan
Write-Host "|                Target: 25M Exit                              |" -ForegroundColor Cyan
Write-Host "+==============================================================+" -ForegroundColor Cyan
Write-Host ""

# Read state file
$State = $null
if (Test-Path $StateFile) {
    try {
        $State = Get-Content $StateFile -Raw | ConvertFrom-Json
    } catch {
        Write-Host "[!] Could not read agent state file" -ForegroundColor Yellow
    }
}

# === URGENT RECOMMENDATIONS ===
Write-Host "[TODAY'S RECOMMENDATIONS]" -ForegroundColor White
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

$UrgentCount = 0

if ($State) {
    # Check daily health
    $DaysHealth = Get-DaysSince $State.checks.'daily-health'.lastRun
    if ($DaysHealth -eq "never" -or [int]$DaysHealth -ge 1) {
        Write-Host "[!] DAILY HEALTH CHECK - Last run: $DaysHealth days ago" -ForegroundColor Red
        Write-Host "    Run: /daily-health" -ForegroundColor Cyan
        $UrgentCount++
    }

    # Check security watch
    $DaysSecurity = Get-DaysSince $State.checks.'security-watch'.lastRun
    if ($DaysSecurity -eq "never" -or [int]$DaysSecurity -ge 1) {
        Write-Host "[!] SECURITY WATCH - Last run: $DaysSecurity days ago" -ForegroundColor Red
        Write-Host "    Run: /security-watch" -ForegroundColor Cyan
        $UrgentCount++
    }

    # Check weekly improvement
    $DaysWeekly = Get-DaysSince $State.checks.'weekly-improvement'.lastRun
    if ($DayOfWeek -eq 1) {
        # Monday
        if ($DaysWeekly -eq "never" -or [int]$DaysWeekly -ge 7) {
            Write-Host "[*] WEEKLY IMPROVEMENT - It is Monday! Time for weekly review" -ForegroundColor Yellow
            Write-Host "    Ask: Run the continuous improvement team" -ForegroundColor Cyan
            $UrgentCount++
        }
    }
    elseif ($DaysWeekly -eq "never" -or [int]$DaysWeekly -ge 7) {
        Write-Host "[*] WEEKLY IMPROVEMENT - Overdue by $DaysWeekly days" -ForegroundColor Yellow
        Write-Host "    Ask: Run the continuous improvement team" -ForegroundColor Cyan
        $UrgentCount++
    }
}
else {
    Write-Host "[!] No state file found - this may be your first session" -ForegroundColor Yellow
    Write-Host "    Run: /daily-health to establish baseline" -ForegroundColor Cyan
    $UrgentCount++
}

if ($UrgentCount -eq 0) {
    Write-Host "[OK] All scheduled checks are up to date!" -ForegroundColor Green
}

Write-Host ""

# === AGENT TEAMS ===
Write-Host "[AGENT TEAMS] 15 agents: 7 Opus / 3 Sonnet / 5 Haiku" -ForegroundColor White
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "Guardian Team (run in background during development)" -ForegroundColor Blue
Write-Host "   security-guardian [Opus], dependency-watcher [Haiku]"
Write-Host ""
Write-Host "Quality Gate Team (run before git push)" -ForegroundColor Blue
Write-Host "   test-runner, build-validator, type-checker, css-enforcer [all Haiku]"
Write-Host ""
Write-Host "Release Readiness Team (run before deploy)" -ForegroundColor Blue
Write-Host "   rls-auditor [Opus], performance-profiler [Opus], api-contract-checker [Opus]"
Write-Host "   mobile-tester [Sonnet], enterprise-readiness [Opus]"
Write-Host ""
Write-Host "Continuous Improvement Team (run weekly)" -ForegroundColor Blue
Write-Host "   council-ops [Opus], web-researcher [Sonnet]"
Write-Host "   tech-debt-tracker [Opus], coverage-improver [Sonnet]"
Write-Host ""

# === QUICK COMMANDS ===
Write-Host "[QUICK COMMANDS]" -ForegroundColor White
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
Write-Host "   /daily-health     Morning health check" -ForegroundColor Cyan
Write-Host "   /qa               Pre-push quality check" -ForegroundColor Cyan
Write-Host "   /security-watch   Security monitoring" -ForegroundColor Cyan
Write-Host "   /run-team         Run an agent team" -ForegroundColor Cyan
Write-Host ""

# === HOW TO USE AGENTS ===
Write-Host "[HOW TO USE AGENTS]" -ForegroundColor White
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
Write-Host "   'Run the quality gate team'       - Pre-push checks"
Write-Host "   'Run security-guardian'           - Single agent"
Write-Host "   'Run release readiness team'      - Pre-deploy audit"
Write-Host "   'Run rls-auditor in background'   - Non-blocking"
Write-Host ""

# === CSS BUDGET ===
Write-Host "[CSS BUDGET STATUS]" -ForegroundColor White
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
if (Test-Path "frontend\src") {
    try {
        $CssFiles = Get-ChildItem -Path "frontend\src" -Filter "*.css" -Recurse -ErrorAction SilentlyContinue
        $CssSize = 0
        foreach ($file in $CssFiles) {
            $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
            if ($content) {
                $CssSize += $content.Length
            }
        }
        $CssKB = [math]::Round($CssSize / 1024)
        $Budget = 1300
        $Percent = [math]::Round(($CssKB / $Budget) * 100)

        if ($CssKB -gt $Budget) {
            Write-Host "   [X] ${CssKB}KB / ${Budget}KB (${Percent}%) - OVER BUDGET" -ForegroundColor Red
        }
        elseif ($Percent -gt 90) {
            Write-Host "   [!] ${CssKB}KB / ${Budget}KB (${Percent}%) - Approaching limit" -ForegroundColor Yellow
        }
        else {
            Write-Host "   [OK] ${CssKB}KB / ${Budget}KB (${Percent}%)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "   Could not check CSS size"
    }
}
else {
    Write-Host "   Could not find frontend/src"
}
Write-Host ""
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""
