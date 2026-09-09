$ErrorActionPreference = 'Stop'

if (Get-Process -Name 'pixtuoid' -ErrorAction SilentlyContinue) { exit 0 }

$binary = Join-Path $env:APPDATA 'npm\node_modules\pixtuoid\node_modules\@pixtuoid\cli-win32-x64\pixtuoid.exe'
if (-not (Test-Path -LiteralPath $binary)) {
  throw 'Pixtuoid não encontrado. Execute: npm install -g pixtuoid'
}

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$command = "Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue; `$env:CLICOLOR_FORCE='1'; `$env:TERM='xterm-256color'; `$env:COLORTERM='truecolor'; Set-Location -LiteralPath '$repo'; & '$binary'"
Start-Process -FilePath 'powershell.exe' -WindowStyle Maximized -ArgumentList @('-NoProfile', '-NoExit', '-Command', $command) -WorkingDirectory $repo
