@echo off
REM Creates a Desktop (and Start Menu) shortcut for FartBrains.
setlocal
set "APPDIR=%~dp0"
set "APPEXE=%APPDIR%FartBrains.exe"

if not exist "%APPEXE%" (
  echo Could not find FartBrains.exe next to this script.
  echo Move this file into the FartBrains folder and run it again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dir in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {" ^
  "  $sc = $ws.CreateShortcut((Join-Path $dir 'FartBrains.lnk'));" ^
  "  $sc.TargetPath = '%APPEXE%';" ^
  "  $sc.WorkingDirectory = '%APPDIR%';" ^
  "  $sc.IconLocation = '%APPEXE%,0';" ^
  "  $sc.Description = 'FartBrains second brain pad';" ^
  "  $sc.Save() }"

echo Done. FartBrains shortcuts added to your Desktop and Start Menu.
pause
