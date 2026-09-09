$ErrorActionPreference = 'Stop'

if (Get-Process -Name 'pixtuoid' -ErrorAction SilentlyContinue) { exit 0 }

$binary = Join-Path $env:APPDATA 'npm\node_modules\pixtuoid\node_modules\@pixtuoid\cli-win32-x64\pixtuoid.exe'
if (-not (Test-Path -LiteralPath $binary)) {
  throw 'Pixtuoid não encontrado. Execute: npm install -g pixtuoid'
}

Start-Process -FilePath $binary -ArgumentList @('floating') -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
