@echo off
chcp 65001 >nul
title Africa University Cafeteria - Server

echo.
echo   ╔════════════════════════════════════════════════╗
echo   ║   كافيتيريا جامعة أفريقيا - الخادم             ║
echo   ║   Africa University Cafeteria - Server         ║
echo   ╚════════════════════════════════════════════════╝
echo.
echo   جاري تشغيل الخادم...
echo   Server starting on: http://localhost:5000
echo.
echo   لإيقاف الخادم اضغط Ctrl+C
echo   ═══════════════════════════════════════════════
echo.

cd /d "%~dp0backend"
node src/index.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo   [✗] حدث خطأ في تشغيل الخادم
    echo       تأكد من تشغيل setup.bat أولاً
    pause
)
