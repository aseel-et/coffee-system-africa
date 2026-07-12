@echo off
chcp 65001 >nul
title Africa University Cafeteria - Desktop

echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║   كافيتيريا جامعة أفريقيا - نسخة سطح المكتب           ║
echo   ║   Africa University Cafeteria - Desktop App           ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
echo   جاري تشغيل البرنامج...
echo.

cd /d "%~dp0"
npm start

if %ERRORLEVEL% neq 0 (
    echo.
    echo   [✗] حدث خطأ في تشغيل البرنامج
    pause
)
