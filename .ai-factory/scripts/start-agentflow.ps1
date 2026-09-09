param(
  [int]$Port = 3100
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtime = Join-Path $repo '.ai-factory\runtime'
$agyBin = Join-Path $env:LOCALAPPDATA 'agy\bin'
$npmCache = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'
$log = Join-Path $runtime 'agentflow.log'

New-Item -ItemType Directory -Path $runtime -Force | Out-Null

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
  if ($health.status -eq 'ok') { exit 0 }
} catch {
  # Expected when AgentFlow is not running.
}

if (Test-Path -LiteralPath $agyBin) {
  $env:PATH = "$agyBin;$env:PATH"
}

# Materialize the pinned package before locating its generated server files.
& npx.cmd -y '@argustech/agentflow@1.3.3' --version | Out-Null

$packages = Get-ChildItem -LiteralPath $npmCache -Directory -ErrorAction SilentlyContinue |
  ForEach-Object {
    Join-Path $_.FullName 'node_modules\@argustech\agentflow'
  } |
  Where-Object {
    Test-Path -LiteralPath (Join-Path $_ 'package.json')
  }

$package = $packages |
  Where-Object {
    try {
      (Get-Content -Raw -LiteralPath (Join-Path $_ 'package.json') | ConvertFrom-Json).version -eq '1.3.3'
    } catch { $false }
  } |
  Select-Object -First 1

if (-not $package) { throw 'AgentFlow 1.3.3 não foi localizado no cache do npx.' }

$templates = Join-Path $package 'dist-server\server\executor\cli-templates.js'
$executor = Join-Path $package 'dist-server\server\executor\cli-executor.js'

$templateText = Get-Content -Raw -LiteralPath $templates
$codexPattern = "(?s)(codex:\s*\{.*?skipPermissionFlag:\s*)'--dangerously-skip-permissions'"
if ($templateText -match $codexPattern) {
  $templateText = [regex]::Replace($templateText, $codexPattern, "`$1'--approve-for-me'", 1)
  Set-Content -LiteralPath $templates -Value $templateText -Encoding utf8
}

$executorText = Get-Content -Raw -LiteralPath $executor
$anchor = '        const additionalWorkspaceDirs = getAdditionalWorkspaceDirs(input.workingDir);'
$addition = @'
        const additionalWorkspaceDirs = getAdditionalWorkspaceDirs(input.workingDir);
        // Antigravity may retain another default project; always add the task workspace.
        if (providerKey === 'antigravity') {
            additionalWorkspaceDirs.unshift(input.workingDir);
        }
'@
if ($executorText.Contains($anchor) -and -not $executorText.Contains("providerKey === 'antigravity'")) {
  $executorText = $executorText.Replace($anchor, $addition.TrimEnd())
  Set-Content -LiteralPath $executor -Value $executorText -Encoding utf8
}

Set-Location -LiteralPath $repo
& npx.cmd -y '@argustech/agentflow@1.3.3' --port $Port *>> $log
