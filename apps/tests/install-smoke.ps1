$ErrorActionPreference = 'Stop'
$installer = Get-ChildItem 'release/Fantazia-RP-Setup-*-x64.exe' | Select-Object -First 1
if (-not $installer) { throw 'Windows installer not found' }
$target = Join-Path $env:RUNNER_TEMP 'FantaziaInstallSmoke'
$install = Start-Process -FilePath $installer.FullName -ArgumentList @('/S', "/D=$target") -PassThru
if (-not $install.WaitForExit(120000)) { $install.Kill(); throw 'Installer timed out' }
if ($install.ExitCode -ne 0) { throw "Installer exit $($install.ExitCode)" }
$game = Join-Path $target 'Fantazia RP 3D.exe'
if (-not (Test-Path $game)) { throw 'Installed executable missing' }
$process = Start-Process -FilePath $game -PassThru
try {
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) { throw "Installed app exited early: $($process.ExitCode)" }
    if ($process.MainWindowHandle -ne 0 -and $process.Responding) { $ready = $true; break }
  }
  if (-not $ready) { throw 'Installed app did not create a responsive window' }
  Write-Host "PASS installed app window: $($process.MainWindowTitle)"
  if (-not $process.CloseMainWindow()) { throw 'Could not close installed app normally' }
  if (-not $process.WaitForExit(20000)) { throw 'Installed app did not quit normally' }
  if ($process.ExitCode -ne 0) { throw "Installed app exit $($process.ExitCode)" }
} finally { if (-not $process.HasExited) { $process.Kill() } }
$uninstaller = Get-ChildItem $target -Filter '*Uninstall*.exe' | Select-Object -First 1
if (-not $uninstaller) { throw 'Uninstaller missing' }
$remove = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru
if (-not $remove.WaitForExit(120000)) { $remove.Kill(); throw 'Uninstaller timed out' }
if ($remove.ExitCode -ne 0) { throw "Uninstaller exit $($remove.ExitCode)" }
(Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLower() + '  ' + $installer.Name | Set-Content -Encoding ascii 'release/SHA256SUMS.txt'
Write-Host 'PASS Windows NSIS silent install, installed app launch/window/normal exit and uninstaller launch.'
