param([switch]$Cuda)
$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Utility
Import-Module Microsoft.PowerShell.Archive
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$setupRoot = Split-Path -Parent $PSScriptRoot
$resources = Get-Content -LiteralPath (Join-Path $setupRoot 'assets/resources.json') -Raw | ConvertFrom-Json

function Write-DownloadProgress([int64]$done, [int64]$total, [double]$speed) {
    $line = if ($total -gt 0) {
        ('  {0,5:N1}%  {1,7:N1}/{2,7:N1} MB  {3,5:N2} MB/s' -f (100.0 * $done / $total), ($done / 1MB), ($total / 1MB), ($speed / 1MB))
    } else {
        ('  {0,7:N1} MB  {1,5:N2} MB/s' -f ($done / 1MB), ($speed / 1MB))
    }
    Write-Host ($line.PadRight(60) + "`r") -NoNewline
}

# 先探测哪个源能连上, 连不上的源不必干等超时.
function Select-DownloadUrl([string[]]$urls) {
    if ($urls.Count -le 1) { return $urls[0] }
    $probeHandler = New-Object System.Net.Http.HttpClientHandler
    $probeHandler.AllowAutoRedirect = $true
    $probeClient = New-Object System.Net.Http.HttpClient($probeHandler)
    $probeClient.Timeout = [TimeSpan]::FromSeconds(8)
    try {
        foreach ($url in $urls) {
            try {
                $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Head, $url)
                $response = $probeClient.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
                $status = [int]$response.StatusCode
                $response.Dispose()
                if ($status -ge 200 -and $status -lt 400) { return $url }
            } catch { }
        }
    } finally {
        $probeClient.Dispose()
        $probeHandler.Dispose()
    }
    return $urls[0]
}

# 断点续传下载: 保留 .part 文件, 用 HTTP Range 从断点继续, 失败自动重试.
# switchWhenSlow: 单次连接持续低于 0.3 MB/s 就中止, 让调用方换源 (仅当还有别的源可试).
function Save-RemoteFile([string]$url, [string]$path, [int]$maxAttempts = 60, [switch]$switchWhenSlow, [switch]$noProxy) {
    $minSpeed = 0.3 * 1MB
    $script:slowSource = $false
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = -not $noProxy
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(100)
    $knownTotal = [int64]0
    $downloaded = [int64]0
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $attempt = 0
    $lastError = ''
    $delay = 2
    $shown = $false
    try {
        while ($true) {
            $offset = [int64]0
            if (Test-Path -LiteralPath $path) { $offset = (Get-Item -LiteralPath $path).Length }
            if ($knownTotal -gt 0 -and $offset -ge $knownTotal) { break }
            if ($attempt -ge $maxAttempts) { throw ('下载失败: 已重试 {0} 次. 最后错误: {1}' -f $attempt, $lastError) }
            $attempt++
            $response = $null; $stream = $null; $file = $null
            $fatal = $false
            try {
                if ($attempt -gt 1) { Write-Host ('  从 {0:N1} MB 处续传 (第 {1} 次尝试)' -f ($offset / 1MB), $attempt) }
                # .NET Framework 不跟随 308, 重定向自己跟, 最多 6 跳
                $requestUrl = $url
                for ($hop = 0; ; $hop++) {
                    $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, $requestUrl)
                    if ($offset -gt 0) { $request.Headers.TryAddWithoutValidation('Range', ('bytes={0}-' -f $offset)) | Out-Null }
                    $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
                    $status = [int]$response.StatusCode
                    $redirect = @(301, 302, 303, 307, 308) -contains $status
                    if ($redirect -and $response.Headers.Location) {
                        $location = $response.Headers.Location
                        if (-not $location.IsAbsoluteUri) { $location = New-Object Uri([Uri]$requestUrl, $location.OriginalString) }
                        $requestUrl = $location.AbsoluteUri
                        $response.Dispose()
                        $response = $null
                        $request.Dispose()
                        if ($hop -ge 6) { throw '重定向次数过多.' }
                        continue
                    }
                    break
                }
                if ($status -eq 416) { Remove-Item -LiteralPath $path -Force; continue }
                if ($status -ne 200 -and $status -ne 206) {
                    $fatal = $status -ge 400 -and $status -lt 500 -and $status -ne 408 -and $status -ne 429
                    throw ('服务器返回 HTTP {0} {1}' -f $status, $response.ReasonPhrase)
                }
                # Nullable<long> 在 PowerShell 里会被拆箱成 Int64, 不能访问 .HasValue/.Value
                $contentRange = $response.Content.Headers.ContentRange
                $contentLength = $response.Content.Headers.ContentLength
                if ($contentRange -and $null -ne $contentRange.Length) {
                    $knownTotal = [int64]$contentRange.Length
                } elseif ($null -ne $contentLength -and $contentLength -ge 0) {
                    $knownTotal = [int64]$contentLength
                }
                if ($status -eq 200) { $offset = [int64]0 }  # 服务器忽略了 Range, 从头写
                $file = New-Object IO.FileStream($path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::Write, [IO.FileShare]::Read)
                $file.SetLength($offset)
                $file.Position = $offset
                $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                $buffer = New-Object byte[] 131072
                $reportAt = 0.0
                $attemptClock = [Diagnostics.Stopwatch]::StartNew()
                $attemptBytes = [int64]0
                $windowAt = 0.0
                $windowBytes = [int64]0
                while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $file.Write($buffer, 0, $read)
                    $offset += $read
                    $downloaded += $read
                    $attemptBytes += $read
                    if ($clock.Elapsed.TotalSeconds - $reportAt -ge 2) {
                        $speed = $downloaded / [Math]::Max($clock.Elapsed.TotalSeconds, 0.001)
                        Write-DownloadProgress $offset $knownTotal $speed
                        $shown = $true
                        $reportAt = $clock.Elapsed.TotalSeconds
                        $elapsed = $attemptClock.Elapsed.TotalSeconds
                        if ($switchWhenSlow -and ($elapsed - $windowAt) -ge 10) {
                            $windowSpeed = ($attemptBytes - $windowBytes) / ($elapsed - $windowAt)
                            $windowAt = $elapsed
                            $windowBytes = $attemptBytes
                            if ($windowSpeed -lt $minSpeed) {
                                $script:slowSource = $true
                                throw ('当前源速度过慢 ({0:N2} MB/s)' -f ($windowSpeed / 1MB))
                            }
                        }
                    }
                }
                $file.Flush()
                if ($knownTotal -gt 0 -and $offset -ge $knownTotal) { break }
                if ($offset -eq 0) { throw '连接未返回任何数据.' }
            } catch {
                if ($script:slowSource) { throw }
                $lastError = $_.Exception.Message
                if ($fatal) { throw }
                Write-Host ''
                Write-Host ('  下载中断: {0}' -f $lastError)
                Write-Host ('  {0} 秒后续传...' -f $delay)
                Start-Sleep -Seconds $delay
                $delay = [Math]::Min($delay * 2, 15)
            } finally {
                if ($stream) { $stream.Dispose() }
                if ($file) { $file.Dispose() }
                if ($response) { $response.Dispose() }
            }
        }
    } finally {
        if ($shown) { Write-Host ('  ' + (' ' * 58) + "`r") -NoNewline; Write-Host '' }
        $client.Dispose()
        $handler.Dispose()
    }
    $size = (Get-Item -LiteralPath $path).Length
    if ($knownTotal -gt 0 -and $size -ne $knownTotal) { throw ('下载不完整: {0}/{1} 字节.' -f $size, $knownTotal) }
}

function Get-Resource($resource) {
    $destination = [IO.Path]::GetFullPath((Join-Path $setupRoot $resource.file))
    if (-not $destination.StartsWith($setupRoot + [IO.Path]::DirectorySeparatorChar)) { throw '资源路径无效.' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    if ((Test-Path -LiteralPath $destination) -and (Get-FileHash -LiteralPath $destination).Hash.ToLowerInvariant() -eq $resource.sha256) { return $destination }
    $partial = $destination + '.part'
    if ((Test-Path -LiteralPath $partial) -and (Get-Item -LiteralPath $partial).Length -gt 0) {
        Write-Host ('继续未完成的下载: ' + [IO.Path]::GetFileName($destination) + (' ({0:N1} MB)' -f ((Get-Item -LiteralPath $partial).Length / 1MB)))
    } else {
        Write-Host ('正在获取: ' + [IO.Path]::GetFileName($destination))
    }
    # 备用镜像走直连: 国内镜像域名通常不需要也受不了系统代理
    $sources = @([pscustomobject]@{ Url = [string]$resource.url; NoProxy = $false })
    if ($resource.mirror) { $sources += [pscustomobject]@{ Url = [string]$resource.mirror; NoProxy = $true } }
    $primary = Select-DownloadUrl @($sources | ForEach-Object { $_.Url })
    $ordered = @($sources | Where-Object { $_.Url -eq $primary }) + @($sources | Where-Object { $_.Url -ne $primary })
    if ($ordered.Count -gt 1) {
        $first = [Uri]$ordered[0].Url
        Write-Host ('  下载源: ' + $first.Host + $(if ($ordered[0].NoProxy) { ' (直连)' } else { '' }))
    }
    for ($round = 1; ; $round++) {
        if ($round -gt 1) { Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue }
        $failure = $null
        $attempts = if ($ordered.Count -gt 1) { 8 } else { 60 }
        for ($i = 0; $i -lt $ordered.Count; $i++) {
            $source = $ordered[$i]
            $script:slowSource = $false
            try {
                Save-RemoteFile $source.Url $partial $attempts -switchWhenSlow:($i -lt $ordered.Count - 1) -noProxy:$source.NoProxy
                $failure = $null
                break
            } catch {
                if ($script:slowSource) {
                    $failure = $null
                    Write-Host ('  当前源太慢, 放弃: ' + $_.Exception.Message)
                } else {
                    $failure = $_.Exception.Message
                    Write-Host ('  当前源失败: {0}' -f $failure)
                }
                if ($i -lt $ordered.Count - 1) {
                    Write-Host ('  切换到备用源: ' + ([Uri]$ordered[$i + 1].Url).Host)
                }
            }
        }
        if ($failure) { throw ('下载失败: ' + $failure) }
        if ((Get-FileHash -LiteralPath $partial).Hash.ToLowerInvariant() -eq $resource.sha256) { break }
        if ($round -ge 2) {
            Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
            throw '下载校验失败, 请重试.'
        }
        Write-Host '校验不匹配, 丢弃断点后重新下载.'
    }
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
# 仓库中该文件用 LF, 避免安装后凭空多出一处换行符差异
$settingsJson = ($settings | ConvertTo-Json) -replace "`r`n", "`n"
[IO.File]::WriteAllText($settingsPath, $settingsJson, (New-Object Text.UTF8Encoding($false)))
Remove-Item -LiteralPath $archive
if ($Cuda) { Remove-Item -LiteralPath $cudaArchive }
Write-Host '运行资源安装完成. 使用npm start启动.'
