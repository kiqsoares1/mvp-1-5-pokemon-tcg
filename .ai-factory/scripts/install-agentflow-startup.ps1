$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$launcher = Join-Path $repo '.ai-factory\scripts\start-agentflow.ps1'
$officeLauncher = Join-Path $repo '.ai-factory\scripts\start-office.ps1'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'AI Factory - AgentFlow.lnk'
$officeShortcutPath = Join-Path $startup 'AI Factory - Escritorio.lnk'
$powershell = (Get-Command powershell.exe).Source

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
$shortcut.WorkingDirectory = $repo
$shortcut.Description = 'Inicia o AgentFlow da AI Factory na entrada do Windows.'
$shortcut.Save()

Write-Output $shortcutPath

$officeShortcut = $shell.CreateShortcut($officeShortcutPath)
$officeShortcut.TargetPath = $powershell
$officeShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$officeLauncher`""
$officeShortcut.WorkingDirectory = $repo
$officeShortcut.Description = 'Abre o escritório visual Pixtuoid da AI Factory.'
$officeShortcut.Save()

Write-Output $officeShortcutPath
