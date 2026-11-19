param([switch]$Cuda)
$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Utility
Import-Module Microsoft.PowerShell.Archive
$setupRoot = Split-Path -Parent $PSScriptRoot
$resources = Get-Content -LiteralPath (Join-Path $setupRoot 'assets/resources.json') -Raw | ConvertFrom-Json
function Get-Resource($resource) {
    $destination = [IO.Path]::GetFullPath((Join-Path $setupRoot $resource.file))
    if (-not $destination.StartsWith($setupRoot + [IO.Path]::DirectorySeparatorChar)) { throw '资源路径无效.' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    if ((Test-Path -LiteralPath $destination) -and (Get-FileHash -LiteralPath $destination).Hash.ToLowerInvariant() -eq $resource.sha256) { return $destination }
    $partial = $destination + '.part'
    Write-Host ('正在获取: ' + [IO.Path]::GetFileName($destination))
    Invoke-WebRequest -UseBasicParsing -Uri $resource.url -OutFile $partial
    if ((Get-FileHash -LiteralPath $partial).Hash.ToLowerInvariant() -ne $resource.sha256) { Remove-Item -LiteralPath $partial; throw '下载校验失败, 请重试.' }
    Move-Item -LiteralPath $partial -Destination $destination -Force
    return $destination
}
Get-Resource $resources.model | Out-Null
$avatarPath = Join-Path $setupRoot 'assets/avatar.vrm'
if (-not (Test-Path -LiteralPath $avatarPath)) { Get-Resource $resources.avatar | Out-Null }
$selected = if ($Cuda) { $resources.cuda } else { $resources.cpu }
$archive = Get-Resource $selected
$runtimePath = Join-Path $setupRoot 'runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $runtimePath -Force
if ($Cuda) { $cudaArchive = Get-Resource $resources.cudart; Expand-Archive -LiteralPath $cudaArchive -DestinationPath $runtimePath -Force }
$settingsPath = Join-Path $setupRoot 'configs/qwen_intent.json'
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$settings.device = if ($Cuda) { 'CUDA0' } else { 'CPU' }
$settings.gpu_layers = if ($Cuda) { 99 } else { 0 }
[IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
Remove-Item -LiteralPath $archive
if ($Cuda) { Remove-Item -LiteralPath $cudaArchive }
Write-Host '运行资源安装完成. 使用npm start启动.'
