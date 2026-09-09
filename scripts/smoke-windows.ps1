$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'This smoke test runs only in the disposable GitHub Windows runner, never against a teacher profile.'
}
$classpilotExecutable = (Resolve-Path 'src-tauri/target/release/classpilot.exe').Path
$smokeStarted = Get-Date
$launched = Start-Process -FilePath $classpilotExecutable -WindowStyle Hidden -PassThru
try {
  # First launch can restart once after selective WebView2 cache cleanup.
  Start-Sleep -Seconds 12
  $matching = @(Get-Process -Name classpilot -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -eq $classpilotExecutable -and $_.StartTime -ge $smokeStarted.AddSeconds(-1)
  })
  if ($matching.Count -eq 0) { throw 'ClassPilot exited during startup.' }
  $window = @($matching | Where-Object { $_.MainWindowHandle -ne 0 })
  if ($window.Count -eq 0) { throw 'ClassPilot started but did not create a native window.' }
  Write-Output 'PASS: Windows executable started and created its native window.'
} finally {
  Get-Process -Name classpilot -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -eq $classpilotExecutable -and $_.StartTime -ge $smokeStarted.AddSeconds(-1)
  } | Stop-Process
  $launched.Dispose()
}
