@echo off
echo =======================================
echo Preparing Database for Packaging...
echo =======================================
set npm_config_runtime=electron
set npm_config_target=29.4.6
set npm_config_disturl=https://electronjs.org/headers
cd backend
call npm rebuild better-sqlite3
cd ..

echo =======================================
echo Building Frontend...
echo =======================================
call npm run build-frontend

echo =======================================
echo Packaging App with Electron Builder...
echo =======================================
call npx electron-builder -w

echo =======================================
echo Restoring Database for Local Dev...
echo =======================================
set npm_config_runtime=
set npm_config_target=
set npm_config_disturl=
cd backend
call npm rebuild better-sqlite3
cd ..

echo =======================================
echo Setup file generated successfully!
echo =======================================
