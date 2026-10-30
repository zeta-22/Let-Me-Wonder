# Let Me Wonder - Phase 0 environment check
#
# READ-ONLY: this only looks at what is installed on your PC. It does not
# install, change or delete anything, and it sends nothing anywhere.
# (If adb is installed it starts adb's small background helper, which is
# what adb always does, and asks a connected phone for its model name.)
#
# How to run: open PowerShell, paste this whole file in, press Enter.
# Then copy everything it prints and paste it back to Claude.

$ErrorActionPreference = 'SilentlyContinue'

function Report([string]$status, [string]$label, [string]$detail) {
    $colors = @{ 'OK' = 'Green'; 'MISSING' = 'Red'; 'CHECK' = 'Yellow'; 'OPTIONAL' = 'DarkYellow'; 'INFO' = 'Gray' }
    Write-Host ("[{0,-8}] {1,-26} {2}" -f $status, $label, $detail) -ForegroundColor $colors[$status]
}

function First-Existing([string[]]$paths) {
    foreach ($p in $paths) { if ($p -and (Test-Path $p)) { return $p } }
    return $null
}

# Runs a program through cmd.exe so its messages come back as plain text.
function Run-Text([string]$commandLine) {
    return ((cmd /c "$commandLine 2>&1") | Select-Object -First 1) -as [string]
}

Write-Host ''
Write-Host '=== Let Me Wonder - environment check (read-only) ===' -ForegroundColor Cyan

# --- Windows -----------------------------------------------------------------
$os = Get-CimInstance Win32_OperatingSystem
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$freeGB = [math]::Round((Get-PSDrive C).Free / 1GB)
Report 'INFO' 'Windows' ("{0} (build {1})" -f $os.Caption, $os.BuildNumber)
Report 'INFO' 'Memory / disk' ("{0} GB RAM, {1} GB free on C:" -f $ramGB, $freeGB)
Report 'INFO' 'PowerShell script policy' ([string](Get-ExecutionPolicy))
if (Get-Command winget) { Report 'OK' 'winget' 'available (used to install tools)' } else { Report 'CHECK' 'winget' 'not found (we can use normal installers instead)' }

# --- Phase 1: Chrome -----------------------------------------------------------
$chrome = First-Existing @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
if ($chrome) { $chromeVersion = (Get-Item $chrome).VersionInfo.ProductVersion; Report 'OK' 'Google Chrome' $chromeVersion } else { Report 'MISSING' 'Google Chrome' 'needed for Phase 1' }

# --- Phase 2+: Git and Node.js ------------------------------------------------
if (Get-Command git) { Report 'OK' 'Git' (Run-Text 'git --version') } else { Report 'MISSING' 'Git' 'needed to download the project code' }

if (Get-Command node) {
    $nodeVersion = Run-Text 'node --version'
    $nodeMajor = [int]($nodeVersion.Trim().TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 22) { Report 'CHECK' 'Node.js' "$nodeVersion - too old, install the current LTS" } elseif ($nodeMajor % 2 -eq 1) { Report 'CHECK' 'Node.js' "$nodeVersion - not an LTS version, install the LTS one" } else { Report 'OK' 'Node.js' $nodeVersion }
    Report 'INFO' 'npm' (Run-Text 'npm --version')
} else {
    Report 'MISSING' 'Node.js' 'needed from Phase 2'
}

# --- Android tools (optional) -------------------------------------------------
$studio = First-Existing @(
    "$env:ProgramFiles\Android\Android Studio\bin\studio64.exe",
    "$env:LOCALAPPDATA\Programs\Android Studio\bin\studio64.exe")
if ($studio) { Report 'OK' 'Android Studio' (Split-Path (Split-Path $studio)) } else { Report 'OPTIONAL' 'Android Studio' 'not installed (only needed for building on your PC)' }

$sdk = First-Existing @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")
if ($sdk) { Report 'INFO' 'Android SDK folder' $sdk }

if (Get-Command java) { Report 'INFO' 'Java' (Run-Text 'java -version') }

$adbCommand = Get-Command adb
$adb = $null
if ($adbCommand) { $adb = $adbCommand.Source } elseif ($sdk) { $adb = First-Existing @("$sdk\platform-tools\adb.exe") }

if (-not $adb) {
    Report 'OPTIONAL' 'adb (platform-tools)' 'not installed'
    Report 'INFO' 'Android phone (USB)' 'cannot check without adb'
} else {
    $adbNote = ''
    if (-not $adbCommand) { $adbNote = ' (installed, but not on PATH)' }
    $adbVersion = [string](& $adb version | Select-Object -First 1)
    Report 'OK' 'adb (platform-tools)' ($adbVersion + $adbNote)

    & $adb start-server 2>&1 | Out-Null
    $lines = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' })
    if ($lines.Count -eq 0) {
        Report 'CHECK' 'Android phone (USB)' 'none found - plug it in with USB debugging on'
    }
    foreach ($line in $lines) {
        $parts = $line -split '\s+'
        $serial = $parts[0]; $state = $parts[1]
        if ($state -eq 'device') {
            $model = [string](& $adb -s $serial shell getprop ro.product.model)
            $android = [string](& $adb -s $serial shell getprop ro.build.version.release)
            Report 'OK' 'Android phone (USB)' "$model, Android $android"
        } elseif ($state -eq 'unauthorized') {
            Report 'CHECK' 'Android phone (USB)' 'connected but not allowed yet - unlock the phone and tap Allow'
        } else {
            Report 'CHECK' 'Android phone (USB)' "connected, state: $state"
        }
    }
}

# --- Nice to have ---------------------------------------------------------------
if (Get-Command code) { Report 'OK' 'VS Code (editor)' 'installed' } else { Report 'OPTIONAL' 'VS Code (editor)' 'not installed (handy for reading the code)' }

Write-Host '=== end of check - copy everything above and paste it back ===' -ForegroundColor Cyan
Write-Host ''
