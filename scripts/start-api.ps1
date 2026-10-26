$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet run --project src/DynamicConstruction.Api --no-launch-profile --urls http://127.0.0.1:5080
