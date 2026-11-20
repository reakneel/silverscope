[CmdletBinding()]
param(
  [string]$BackupRoot = (Join-Path $PSScriptRoot "..\..\backups\supabase"),
  [ValidateRange(1, 3650)][int]$RetentionDays = 30
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) { throw "Set SUPABASE_DB_URL to the Supabase PostgreSQL connection URI." }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "pg_dump is required. Install PostgreSQL client tools and add them to PATH." }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "pg_restore is required. Install PostgreSQL client tools and add them to PATH." }

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$name = "silverscope-supabase-$stamp"
$tmp = Join-Path $BackupRoot "$name.dump.partial"
$dump = Join-Path $BackupRoot "$name.dump"
$env:PGSSLMODE = "require"
try {
  & pg_dump --dbname=$env:SUPABASE_DB_URL --format=custom --no-owner --no-acl --compress=9 --file=$tmp
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
  & pg_restore --list $tmp | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "pg_restore could not read the generated archive." }
  Move-Item -LiteralPath $tmp -Destination $dump
  $hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $BackupRoot "$name.sha256") -Value "$hash  $name.dump" -NoNewline
  $manifest = [ordered]@{
    createdAt = [DateTime]::UtcNow.ToString("o")
    format = "PostgreSQL custom archive"
    file = "$name.dump"
    sha256 = $hash
    postgresClient = ((& pg_dump --version) -join " ")
    includes = "Database schemas and table data accessible to the backup role"
    excludes = @("Supabase Storage object bytes", "Vercel environment variables", "external provider secrets")
  }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $BackupRoot "$name.json") -Encoding UTF8
  $cutoff = [DateTime]::UtcNow.AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $BackupRoot -Filter "silverscope-supabase-*.dump" -File |
    Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
    ForEach-Object {
      $base = [IO.Path]::ChangeExtension($_.FullName, $null)
      Remove-Item -LiteralPath $_.FullName -Force
      Remove-Item -LiteralPath "$base.sha256","$base.json" -Force -ErrorAction SilentlyContinue
    }
  Write-Host "Backup created: $dump"
  Write-Host "SHA-256: $hash"
  Write-Host "Retention: $RetentionDays days"
} finally {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
}
