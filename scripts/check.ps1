param([switch]$Restore)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

$dotnetCommand = (Get-Command dotnet -ErrorAction Stop).Source
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) { $npmCommand = Get-Command npm -ErrorAction Stop }

if ($Restore) {
    Invoke-Checked $dotnetCommand @('tool', 'restore')
    Invoke-Checked $dotnetCommand @('restore', '--locked-mode')
    Invoke-Checked $npmCommand.Source @('ci', '--prefix', 'src/web')
}

Invoke-Checked $dotnetCommand @('build', '-c', 'Release', '--no-restore')
Invoke-Checked $dotnetCommand @('test', '-c', 'Release', '--no-restore')
Invoke-Checked $npmCommand.Source @('run', 'build', '--prefix', 'src/web')
Invoke-Checked $npmCommand.Source @('run', 'test', '--prefix', 'src/web')

Write-Host 'Local build and unit tests passed. Run the isolated API/browser checks separately.'
