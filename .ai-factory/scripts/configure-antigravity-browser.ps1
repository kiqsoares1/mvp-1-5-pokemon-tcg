$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$profile = Join-Path $repo '.ai-factory\runtime\playwright-profile'
$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'

if (-not (Test-Path -LiteralPath $agy)) { throw 'Antigravity CLI não encontrada.' }

& $agy mcp add playwright -- npx.cmd -y '@playwright/mcp@latest' '--browser=chrome' "--user-data-dir=$profile" '--viewport-size=1280x800' '--console-level=error'

$settingsPath = Join-Path $env:USERPROFILE '.gemini\antigravity-cli\settings.json'
$settingsDir = Split-Path -Parent $settingsPath
New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
$settings = if (Test-Path -LiteralPath $settingsPath) {
  Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
} else { [pscustomobject]@{} }

if (-not $settings.PSObject.Properties['permissions']) {
  $settings | Add-Member -NotePropertyName permissions -NotePropertyValue ([pscustomobject]@{})
}
if (-not $settings.permissions.PSObject.Properties['allow']) {
  $settings.permissions | Add-Member -NotePropertyName allow -NotePropertyValue @()
}

$rules = @(
  'read_url(docs.google.com)', 'execute_url(docs.google.com)',
  'read_url(script.google.com)', 'execute_url(script.google.com)',
  'read_url(accounts.google.com)', 'execute_url(accounts.google.com)',
  'read_url(googleusercontent.com)', 'execute_url(googleusercontent.com)',
  'mcp(playwright/*)'
)
$settings.permissions.allow = @(@($settings.permissions.allow) + $rules | Select-Object -Unique)
$settings | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $settingsPath -Encoding utf8

Write-Output 'Playwright MCP configurado no Antigravity.'
