# Compile the optional, standalone Windows Raw Input helper (no NDI SDK).
# Requires x64 MSVC Developer Command Prompt or CI with MSVC prepared.
$ErrorActionPreference = 'Stop'
$compiler = Get-Command cl.exe -ErrorAction SilentlyContinue
if (-not $compiler) {
  throw 'MSVC cl.exe not found. Use an x64 Developer Command Prompt.'
}
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'native/raw-input-helper/raw_input.cpp'
$outputDir = Join-Path $root 'native/raw-input-helper/bin'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Push-Location $outputDir
try {
  & cl.exe /nologo /std:c++17 /EHsc /W4 /utf-8 /O2 $source user32.lib /Fe:gc-raw-input.exe
  if ($LASTEXITCODE -ne 0) { throw "Raw Input helper compile failed: $LASTEXITCODE" }
  if (-not (Test-Path 'gc-raw-input.exe')) { throw 'Helper executable missing after compile' }
} finally {
  Pop-Location
}
Write-Host "Built $outputDir\gc-raw-input.exe"
