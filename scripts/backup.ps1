# Backup the production database using pg_dump.
#
# Usage:
#   ./scripts/backup.ps1                       # writes to ./backups/<timestamp>.dump
#   ./scripts/backup.ps1 -OutDir D:\backups    # writes to a custom directory
#
# Requires:
#   - DATABASE_DIRECT_URL set in the environment (admin URL) OR pass -DatabaseUrl.
#   - pg_dump on PATH (matching Postgres major version).
#
# The script writes a custom-format dump (pg_restore-compatible) plus a
# checksum sidecar so corruption is detectable at restore time.

[CmdletBinding()]
param(
  [string]$OutDir = "$(Get-Location)\backups",
  [string]$DatabaseUrl = $env:DATABASE_DIRECT_URL
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  throw "DATABASE_DIRECT_URL not set. Pass -DatabaseUrl or set the environment variable."
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump not found on PATH. Install the matching Postgres client tools."
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $OutDir "erp-agencia-$timestamp.dump"

Write-Host "Writing backup to $dumpPath"
& pg_dump --format=custom --no-owner --no-privileges --file=$dumpPath $DatabaseUrl
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

$hash = (Get-FileHash -Algorithm SHA256 $dumpPath).Hash
Set-Content -Path "$dumpPath.sha256" -Value $hash -Encoding ASCII

Write-Host "Backup complete: $dumpPath"
Write-Host "SHA-256: $hash"
