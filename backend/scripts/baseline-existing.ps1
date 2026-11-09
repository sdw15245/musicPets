param([string]$Backup)
$ErrorActionPreference = 'Stop'
# Explicit local admin entry point. Credentials stay in the child process environment.
$backend = Split-Path -Parent $PSScriptRoot
$previous = @{}
try {
    foreach ($key in @('DB_URL', 'DB_USERNAME', 'DB_PASSWORD')) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    }
    $envFile = Join-Path $backend '.env'
    if (Test-Path -LiteralPath $envFile) {
        Get-Content -LiteralPath $envFile | ForEach-Object {
            if ($_ -match '^\s*(DB_URL|DB_USERNAME|DB_PASSWORD)\s*=\s*(.*)$') {
                if ($null -eq [Environment]::GetEnvironmentVariable($matches[1], 'Process')) {
                    [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim().Trim('"').Trim("'"), 'Process')
                }
            }
        }
    }
    Push-Location -LiteralPath $backend
    try {
        if ($Backup) {
            $resolvedBackup = (Resolve-Path -LiteralPath $Backup).Path
            & .\gradlew.bat baselineExisting "-PbaselineBackup=$resolvedBackup"
        } else { & .\gradlew.bat baselineExisting }
        if ($LASTEXITCODE -ne 0) { throw 'Schema check / baseline failed. Application tables were not modified by this command.' }
    } finally { Pop-Location }
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
