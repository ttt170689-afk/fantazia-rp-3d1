$ErrorActionPreference = 'Stop'
$archive = Get-ChildItem 'release/Fantazia-RP-Portable-*-win-x64.zip' | Select-Object -First 1
if (-not $archive) { throw 'Portable ZIP not found' }
$target = Join-Path $env:RUNNER_TEMP 'Fantazia Portable Smoke'
Expand-Archive -LiteralPath $archive.FullName -DestinationPath $target -Force
foreach ($required in @('Fantazia RP 3D.exe','resources/app.asar','locales','README-PORTABLE-RU.txt')) {
  if (-not (Test-Path (Join-Path $target $required))) { throw "Missing portable file: $required" }
}
if (Get-ChildItem $target -Filter '*Uninstall*.exe') { throw 'Portable archive must not contain an uninstaller' }
$process = Start-Process -FilePath (Join-Path $target 'Fantazia RP 3D.exe') -WorkingDirectory $target -PassThru
try {
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) { throw "Portable app exited early: $($process.ExitCode)" }
    if ($process.MainWindowHandle -ne 0 -and $process.Responding) { $ready = $true; break }
  }
  if (-not $ready) { throw 'Portable app did not open a responsive window' }
  Write-Host "PASS portable window: $($process.MainWindowTitle)"
  if (-not $process.CloseMainWindow()) { throw 'Could not close portable app normally' }
  if (-not $process.WaitForExit(20000)) { throw 'Portable app did not quit normally' }
  if ($process.ExitCode -ne 0) { throw "Portable app exit $($process.ExitCode)" }
} finally { if (-not $process.HasExited) { $process.Kill() } }
(Get-FileHash $archive.FullName -Algorithm SHA256).Hash.ToLower() + '  ' + $archive.Name | Set-Content -Encoding ascii 'release/SHA256SUMS.txt'
Write-Host 'PASS exact release ZIP: extract to path with spaces, bundled resources, executable launch without installation, responsive window and normal exit.'
