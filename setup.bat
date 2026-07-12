@echo off
chcp 65001 >nul
title Africa University Cafeteria - Setup

echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║   إعداد نظام كافيتيريا جامعة أفريقيا                 ║
echo   ║   Africa University Cafeteria - System Setup          ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [✗] Node.js غير مثبت!
    echo       يرجى تثبيت Node.js من: https://nodejs.org
    echo       ثم أعد تشغيل هذا الملف.
    pause
    exit /b 1
)

echo   [✓] Node.js موجود
for /f "tokens=*" %%i in ('node -v') do echo       الإصدار: %%i
echo.

REM ── Backend Setup ──
echo   ══════════════════════════════════════════════
echo   [1/4] تثبيت مكتبات الخادم (Backend)...
echo   ══════════════════════════════════════════════
cd /d "%~dp0backend"
call npm install --production
if %ERRORLEVEL% neq 0 (
    echo   [✗] فشل تثبيت مكتبات الخادم
    pause
    exit /b 1
)
echo   [✓] تم تثبيت مكتبات الخادم
echo.

REM ── Frontend Setup ──
echo   ══════════════════════════════════════════════
echo   [2/4] تثبيت مكتبات الواجهة (Frontend)...
echo   ══════════════════════════════════════════════
cd /d "%~dp0frontend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo   [✗] فشل تثبيت مكتبات الواجهة
    pause
    exit /b 1
)
echo   [✓] تم تثبيت مكتبات الواجهة
echo.

REM ── Build Frontend ──
echo   ══════════════════════════════════════════════
echo   [3/4] بناء الواجهة الأمامية (Production Build)...
echo   ══════════════════════════════════════════════
call npm run build
if %ERRORLEVEL% neq 0 (
    echo   [✗] فشل بناء الواجهة الأمامية
    pause
    exit /b 1
)
echo   [✓] تم بناء الواجهة الأمامية
echo.

REM ── Create .env if not exists ──
echo   ══════════════════════════════════════════════
echo   [4/4] إعداد ملف التكوين...
echo   ══════════════════════════════════════════════
cd /d "%~dp0backend"
if not exist ".env" (
    (
        echo PORT=5000
        echo JWT_SECRET=africa_university_cafeteria_jwt_secret_2026_very_long_key
        echo NODE_ENV=production
        echo DB_PATH=./src/database/cafeteria.db
    ) > .env
    echo   [✓] تم إنشاء ملف التكوين
) else (
    echo   [✓] ملف التكوين موجود مسبقاً
)

REM ── Initialize Database ──
cd /d "%~dp0backend"
node -e "require('./src/database/schema').createTables(); console.log('  [✓] تم تهيئة قاعدة البيانات');"

echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║          ✅ تم الإعداد بنجاح!                         ║
echo   ║                                                       ║
echo   ║   لتشغيل النظام، انقر نقرتين على:                    ║
echo   ║   start-server.bat                                    ║
echo   ║                                                       ║
echo   ║   ثم افتح المتصفح على:                                 ║
echo   ║   http://localhost:5000                               ║
echo   ║                                                       ║
echo   ║   أو استخدم start-pos.bat للطباعة الصامتة             ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
pause
