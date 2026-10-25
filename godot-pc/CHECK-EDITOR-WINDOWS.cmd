@echo off
setlocal
if "%~1"=="" goto usage
if not exist "%~1" goto usage
if not exist "%~dp0project.godot" goto missing
pushd "%~dp0"
echo Opening Fantazia 05 in NORMAL editor mode.
echo No GLB importer is needed by this version.
echo Log: %~dp0editor-start-05.log
"%~1" --editor --path "%~dp0." --rendering-method gl_compatibility --verbose --log-file "%~dp0editor-start-05.log"
set "RESULT=%ERRORLEVEL%"
echo.
echo Godot exit code: %RESULT%
echo If it crashed, send editor-start-05.log and your Godot version.
popd
pause
exit /b %RESULT%
:usage
echo Drag your Godot 4.5.1+ executable onto this CMD file.
echo Prefer the console executable if it is included with your Godot download.
echo This script does not download anything or delete any files.
pause
exit /b 2
:missing
echo project.godot is missing. Extract the entire version 05 archive first.
pause
exit /b 2
