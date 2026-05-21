# Restore a pg_dump dump produced by ./scripts/backup.ps1 into a target database.
#
# Usage:
#   ./scripts/restore.ps1 -DumpPath .\backups\erp-agencia-20260521-090000.dump `
#                         -DatabaseUrl postgres://user:pass@host:5432/erp_restore
#
# Requires pg_restore on PATH (matching Postgres major version).
#
# Safety: the target database MUST be empty or you must pass -CleanFirst.
# This script never targets the URL in $env:DATABASE_URL by default - you must
# pass a separate URL for the restore target to avoid clobbering production.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$DumpPath,
  [Parameter(Mandatory = $true)][string]$DatabaseUrl,
  [switch]$CleanFirst
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpPath)) {
  throw "Dump file not found: $DumpPath"
}

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore not found on PATH. Install the matching Postgres client tools."
}

$sidecar = "$DumpPath.sha256"
if (Test-Path $sidecar) {
  $expected = (Get-Content $sidecar -Raw).Trim()
  $actual = (Get-FileHash -Algorithm SHA256 $DumpPath).Hash
  if ($expected -ne $actual) {
    throw "Checksum mismatch for $DumpPath. Expected $expected got $actual."
  }
  Write-Host "Checksum OK ($actual)"
} else {
  Write-Warning "No .sha256 sidecar found; skipping integrity check."
}

$cleanFlag = if ($CleanFirst) { "--clean" } else { $null }
Write-Host "Restoring $DumpPath into $DatabaseUrl"
& pg_restore --no-owner --no-privileges $cleanFlag --dbname=$DatabaseUrl $DumpPath
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host "Restore complete."
