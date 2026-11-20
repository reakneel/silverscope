[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:RESTORE_DATABASE_URL)) { throw "Set RESTORE_DATABASE_URL to a LOCAL Supabase/PostgreSQL database URI." }
if ($env:ALLOW_DESTRUCTIVE_RESTORE -ne "YES") { throw "Restore replaces objects in the target database. Set ALLOW_DESTRUCTIVE_RESTORE=YES only after confirming the target." }
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw "Backup file not found: $BackupFile" }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "pg_restore is required. Install PostgreSQL client tools." }
$match = [regex]::Match($env:RESTORE_DATABASE_URL, '^postgres(?:ql)?://[^@]+@(?<host>\[[^\]]+\]|[^:/?]+)')
if (-not $match.Success) { throw "RESTORE_DATABASE_URL must be a PostgreSQL URI." }
$hostName = $match.Groups["host"].Value.Trim('[',']')
if ($hostName -notin @("localhost","127.0.0.1","::1")) { throw "Refusing restore: target host '$hostName' is not local." }
$checksumFile = [IO.Path]::ChangeExtension((Resolve-Path -LiteralPath $BackupFile).Path, ".sha256")
if (Test-Path -LiteralPath $checksumFile) {
  $expected = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "SHA-256 mismatch. Restore aborted." }
}
& pg_restore --list $BackupFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Backup archive validation failed." }
$env:PGSSLMODE = "disable"
& pg_restore --dbname=$env:RESTORE_DATABASE_URL --clean --if-exists --no-owner --no-acl --exit-on-error $BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE." }
Write-Host "Restore completed into local database host: $hostName"
