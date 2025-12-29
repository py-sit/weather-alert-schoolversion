# Build start_skyalert.exe from StartSkyAlertLauncher.cs using the first available csc.exe
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $repoRoot

$src = Join-Path $repoRoot 'StartSkyAlertLauncher.cs'
if (-not (Test-Path -LiteralPath $src)) {
    Write-Error "缺少源文件: $src"
    exit 1
}

$searchPattern = Join-Path $env:WINDIR 'Microsoft.NET\Framework*\*\csc.exe'
# Get-ChildItem -File is not available on older PowerShell versions, so filter manually.
$cscCandidates = @(Get-ChildItem -Path $searchPattern -Recurse -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | Sort-Object -Property FullName -Descending)

if ($cscCandidates.Count -eq 0) {
    Write-Error "未找到 csc.exe，请在 Windows 上安装 .NET Framework SDK / 开发者工具（包含命令行编译器）。"
    exit 1
}

$csc = $cscCandidates[0].FullName
$target = Join-Path $repoRoot 'start_skyalert.exe'

Write-Host "使用编译器: $csc"
Write-Host "输出路径: $target"

& $csc /nologo /t:exe /out:$target $src

Write-Host "完成。已生成 start_skyalert.exe，放在与 start_skyalert.bat 同目录下即可双击运行。"
