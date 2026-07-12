@echo off
cd "%~dp0backend"
echo Uninstalling old version...
call npm uninstall better-sqlite3

echo Installing Electron compatible version...
set npm_config_runtime=electron
set npm_config_target=29.1.5
set npm_config_disturl=https://electronjs.org/headers
call npm install better-sqlite3@11.5.0

echo Done! Now you can run npm run dist again.
pause
