# MouseFlow / Hivelink agent - the Windows installer (Hivelink H4).
#
# WHY THIS EXISTS. The one-line start pipes the agent into a scriptblock and runs it in memory: nothing to
# download, nothing for the execution policy to refuse - and nothing on disk, so it cannot start at logon
# and it is gone when the window closes. One machine on somebody's desk survives that; a fleet of ten does
# not - every reboot takes a machine out of the account until somebody walks over to it. This installer
# keeps the agent on disk and starts it at every logon, the way install-mac.sh makes a login item.
#
# RUN IT THE SAME WAY AS THE AGENT, from a scriptblock, never with -File:
#
#   & ([scriptblock]::Create((irm https://YOUR-APP/agent/install-windows.ps1))) -Origin https://YOUR-APP
#
# and with a code from Devices -> Add machines, so nobody signs in on this PC:
#
#   ... -Origin https://YOUR-APP -Enroll HL-XXXXX-XXXXX -Name "Office-3"
#
# WHAT IT PUTS WHERE - all per user, no admin rights, all undone by -Uninstall:
#
#   %LOCALAPPDATA%\MouseFlow\mouseflow-agent.ps1   the agent, refreshed from the deployment at every logon
#   %LOCALAPPDATA%\MouseFlow\start-agent.ps1       what the logon launcher runs: refresh, then start
#   <Startup>\MouseFlowAgent.cmd                    the logon launcher - the same file the agent's own
#                                                  autostart writes, so /health reports it as on and the
#                                                  agent's "disable autostart" removes it
#
# EXECUTION POLICY. Nothing here is run with -File. On a machine whose policy comes from Group Policy -
# most corporate estates - AllSigned outranks -ExecutionPolicy Bypass and an unsigned .ps1 is refused. The
# launcher reads the file and hands its text to a scriptblock, which never loads a file, so the policy never
# engages. That is the same trade the one-liner makes, stated in README.md.
#
# UPDATES. The launcher fetches the agent from the deployment before every start and keeps the local copy
# when the fetch fails, so a PC updates itself at its next logon and still starts when offline. The cost is
# the one-liner's: whatever is at that address runs. It is your own deployment; that is the condition.
#
# NEVER `exit`. This runs inside the person's own PowerShell window; `exit` would close it. Every early
# stop is `return`.

param(
    [string]$Origin = 'https://mouseflowapp.vercel.app',
    [int]$Port = 8787,
    [string]$Enroll = '',
    [string]$Name = '',
    [switch]$NoStart,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$Origin = $Origin.Trim().TrimEnd('/')
$dir = Join-Path $env:LOCALAPPDATA 'MouseFlow'
$agent = Join-Path $dir 'mouseflow-agent.ps1'
$start = Join-Path $dir 'start-agent.ps1'
$launcher = Join-Path ([Environment]::GetFolderPath('Startup')) 'MouseFlowAgent.cmd'
$utf8 = New-Object System.Text.UTF8Encoding($false)

# The agent running from this install, or from an older one-liner left open. Found by its command line,
# because that is the one thing both kinds share: they all carry the agent's own text or file name.
function Stop-Agent {
    $mine = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine -like '*start-agent.ps1*' -or $_.CommandLine -like '*mouseflow-agent.ps1*') }
    foreach ($one in $mine) {
        try { Stop-Process -Id $one.ProcessId -Force -ErrorAction Stop; Write-Host "  stopped     the agent that was running (pid $($one.ProcessId))" } catch { }
    }
}

function Test-Health([int]$port) {
    try { return Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 1 } catch { return $null }
}

if ($Uninstall) {
    Stop-Agent
    if (Test-Path $launcher) { Remove-Item $launcher -Force }
    # The account file goes too: an uninstalled PC should not stay in the account as a machine that might
    # come back. Remove it from Devices to revoke its token on the server as well.
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Write-Host "  removed     the logon launcher and $dir"
    Write-Host "              remove this PC on Devices too, so its token stops working on the server"
    return
}

Write-Host ""
Write-Host "  MouseFlow agent - installing for $env:USERNAME on $env:COMPUTERNAME" -ForegroundColor Cyan

# ---------------------------------------------------------------- the agent, on disk
New-Item -ItemType Directory -Force -Path $dir | Out-Null
try {
    $text = Invoke-RestMethod -Uri "$Origin/agent/mouseflow-agent.ps1" -TimeoutSec 60
} catch {
    Write-Host "  FAILED      could not fetch the agent from $Origin - $($_.Exception.Message)" -ForegroundColor Yellow
    return
}
# The agent's own marker, so an error page served with 200 is never saved as the agent.
if (-not ($text -is [string]) -or -not $text.Contains('public const string Version')) {
    Write-Host "  FAILED      $Origin/agent/mouseflow-agent.ps1 did not answer with the agent" -ForegroundColor Yellow
    return
}
[IO.File]::WriteAllText($agent, $text, $utf8)
$version = ([regex]::Match($text, 'public const string Version = "([^"]+)"')).Groups[1].Value
Write-Host "  agent       $version -> $agent"

# ---------------------------------------------------------------- what the launcher runs
# Origin and port are baked in here, never taken from anywhere at logon: the launcher is persistence, and
# persistence whose arguments came from a request is the shape of an attack (README, "Autostart").
$startText = @"
# Written by the MouseFlow installer. Refreshes the agent from the deployment, then starts it.
`$dir = Join-Path `$env:LOCALAPPDATA 'MouseFlow'
`$agent = Join-Path `$dir 'mouseflow-agent.ps1'
try {
    `$fresh = Invoke-RestMethod -Uri '$Origin/agent/mouseflow-agent.ps1' -TimeoutSec 20
    if ((`$fresh -is [string]) -and `$fresh.Contains('public const string Version')) {
        [IO.File]::WriteAllText(`$agent, `$fresh, (New-Object System.Text.UTF8Encoding(`$false)))
    }
} catch { }
if (-not (Test-Path `$agent)) { return }
& ([scriptblock]::Create([IO.File]::ReadAllText(`$agent))) -AllowOrigin '$Origin' -Port $Port
"@
[IO.File]::WriteAllText($start, $startText, $utf8)

# ---------------------------------------------------------------- at logon
$launcherText = "@echo off`r`n" +
    "rem Created by the MouseFlow installer. Delete this file to stop the agent starting at logon.`r`n" +
    "start `"`" powershell -NoProfile -WindowStyle Hidden -Command `"& ([scriptblock]::Create([IO.File]::ReadAllText('%LOCALAPPDATA%\MouseFlow\start-agent.ps1')))`"`r`n"
[IO.File]::WriteAllText($launcher, $launcherText, (New-Object System.Text.ASCIIEncoding))
Write-Host "  at logon    $launcher"

# ---------------------------------------------------------------- the account
# In a child process: the agent ends -EnrollOnly with `exit`, which here would close this window.
if ($Enroll) {
    $enrolArgs = "-AllowOrigin '$Origin' -Base '$Origin' -Enroll '$($Enroll -replace "'", '')' -EnrollOnly"
    if ($Name) { $enrolArgs += " -Name '$($Name -replace "'", '')'" }
    $command = "& ([scriptblock]::Create([IO.File]::ReadAllText('$agent'))) $enrolArgs"
    & powershell -NoProfile -Command $command
    if ($LASTEXITCODE -eq 0) {
        $asName = ''
        if ($Name) { $asName = ' as "' + $Name + '"' }
        Write-Host ("  account     attached" + $asName + " - it takes work as soon as it starts") -ForegroundColor Green
    } else {
        Write-Host "  account     NOT attached with that code (see the line above). Make a new code on Devices" -ForegroundColor Yellow
        Write-Host "              and run this again, or attach it from the app's Connections screen."
    }
}

if ($NoStart) {
    Write-Host "  not started, as asked - it starts at the next logon"
    return
}

# ---------------------------------------------------------------- now
# An agent already on the port is the old one: stopped, so the fresh copy can listen there.
Stop-Agent
Start-Process -FilePath 'powershell' -WindowStyle Hidden -ArgumentList @(
    '-NoProfile', '-WindowStyle', 'Hidden', '-Command',
    "& ([scriptblock]::Create([IO.File]::ReadAllText('$start')))"
) | Out-Null

# Said by asking it, not by assuming: compiling the agent takes a few seconds on first start.
$health = $null
for ($i = 0; $i -lt 40 -and -not $health; $i++) {
    Start-Sleep -Milliseconds 750
    $health = Test-Health $Port
}
if ($health) {
    Write-Host "  running     answering on 127.0.0.1:$Port, version $($health.version)" -ForegroundColor Green
    if ($health.linked) {
        $state = 'attached, not taking work - switch it on in the tray'
        if ($health.taking) { $state = 'attached and taking work' }
        Write-Host ("  account     " + $state)
    } else {
        Write-Host "  account     not attached - use a code from Devices, or Connections in the app"
    }
    Write-Host "  tray        the MouseFlow icon in the notification area turns taking work off and on"
} else {
    Write-Host "  started, but not answering on 127.0.0.1:$Port yet. Run the agent in a window to see why:" -ForegroundColor Yellow
    Write-Host "  & ([scriptblock]::Create([IO.File]::ReadAllText('$agent'))) -AllowOrigin '$Origin'"
}
Write-Host ""
