param([Parameter(Mandatory=$true)][ValidateSet('server','importer')][string]$Role,[switch]$XmlOnly)
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$node=Join-Path $project 'runtime\node.exe'
$runner=Join-Path $project 'tools\run-production.mjs'
if (-not (Test-Path -LiteralPath $node)) { throw 'Packaged Node.js is missing' }
$name='Q2PRO-X-BotStats-'+$Role
$arguments='"'+$runner+'" '+$Role
$user=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action=New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $project
$triggers=@((New-ScheduledTaskTrigger -AtStartup),(New-ScheduledTaskTrigger -AtLogOn -User $user))
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -Hidden
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$task=New-ScheduledTask -Action $action -Trigger $triggers -Settings $settings -Principal $principal
if ($XmlOnly) { $task | Export-ScheduledTask; return }
$existing=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($existing -and ($existing.Actions.Execute -ne $node -or $existing.Actions.Arguments -ne $arguments)) { throw 'A different task already uses this name; nothing changed' }
Register-ScheduledTask -TaskName $name -InputObject $task -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Output "Installed and started $name as $user. Other tasks and filesystem permissions are unchanged."
