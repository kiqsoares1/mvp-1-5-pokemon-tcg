param(
  [string]$BaseUrl = 'http://127.0.0.1:3100/api'
)

$ErrorActionPreference = 'Stop'

$model = @{
  id = 'antigravity:gemini-3.8-flash-low'
  provider = 'antigravity'
  label = 'Gemini 3.8 Flash Low'
  color = '#8B5CF6'
  bg = '#120A20'
  costPer1k = 0
  cliFlag = 'gemini-3.8-flash-low'
  sortOrder = 0
  enabled = $true
}

try {
  Invoke-RestMethod -Uri "$BaseUrl/models" -Method Post -ContentType 'application/json' -Body ($model | ConvertTo-Json) | Out-Null
} catch {
  Invoke-RestMethod -Uri "$BaseUrl/models/antigravity%3Agemini-3.8-flash-low" -Method Put -ContentType 'application/json' -Body (@{
    cliFlag = 'gemini-3.8-flash-low'; enabled = $true
  } | ConvertTo-Json) | Out-Null
}

$agents = @{
  'pokemon-manager' = @{
    defaultModel = 'claude:haiku'
    prompt = 'Coordinate pokemon-tcg-mvp economically. Read PROJECT.md, the task, and at most the directly relevant files. Create one executor task at a time. Use existing handoffs instead of transcripts. Stop after one failed attempt and report the blocker. Preserve task IDs and Git SHAs. External writes, clasp, spreadsheet mutation, merge, push, and deploy require user authorization.'
  }
  'pokemon-developer' = @{
    defaultModel = 'codex:gpt-5.6-luna'
    prompt = 'Implement only the requested scope in the task worktree. Read PROJECT.md plus named relevant files; do not scan the whole repository. Make the smallest change, run only necessary checks, create one local commit, and return base/head SHAs, files, checks, and risks. Do not clasp, mutate Sheets, merge, push, deploy, or retry without authorization.'
  }
  'pokemon-qa' = @{
    defaultModel = 'antigravity:gemini-3.8-flash-low'
    prompt = 'Perform concise browser QA for pokemon-tcg-mvp using the Playwright MCP when authorized. Read PROJECT.md and the named handoff only. Confirm target SHA, test only listed acceptance criteria, capture brief evidence, and report PASS/FAIL/BLOCKED. Never edit code or spreadsheet data, run clasp, merge, push, or deploy.'
  }
}

foreach ($entry in $agents.GetEnumerator()) {
  Invoke-RestMethod -Uri "$BaseUrl/agents/$($entry.Key)" -Method Put -ContentType 'application/json' -Body ($entry.Value | ConvertTo-Json) | Out-Null
}

Invoke-RestMethod -Uri "$BaseUrl/settings" -Method Put -ContentType 'application/json' -Body (@{
  max_parallel_tasks = '1'
  max_iterations = '1'
  max_spawned_tasks_per_completion = '2'
  max_retries = '0'
  default_task_timeout_ms = '900000'
  breakdown_timeout_ms = '300000'
  approval_mode = 'manual'
  cli_skip_permissions = 'false'
} | ConvertTo-Json) | Out-Null

Write-Output 'AgentFlow Economy configurado.'
