@echo off
chcp 65001 >nul
title Africa University Cafeteria - POS

REM ===================================================
REM   POS Silent Printing Launcher
REM   Opens the browser with direct/silent printing
REM   (no print dialog - prints to default printer)
REM ===================================================

REM Detect if frontend/dist exists (production mode)
if exist "%~dp0frontend\dist\index.html" (
    set POS_URL=http://localhost:5000
) else (
    set POS_URL=http://localhost:5173
)

echo.
echo   كافيتيريا جامعة أفريقيا - نقطة البيع
echo   ========================================
echo   جاري فتح المتصفح مع الطباعة الصامتة...
echo   URL: %POS_URL%
echo.

REM Try Chrome (64-bit) first
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo   [✓] تم العثور على Google Chrome
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\CafeteriaPOS" %POS_URL%
    goto :done
)

REM Try Chrome (32-bit)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo   [✓] تم العثور على Google Chrome
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\CafeteriaPOS" %POS_URL%
    goto :done
)

REM Fallback to Microsoft Edge
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo   [✓] تم العثور على Microsoft Edge
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\CafeteriaPOS" %POS_URL%
    goto :done
)

REM Try Edge in Program Files
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    echo   [✓] تم العثور على Microsoft Edge
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\CafeteriaPOS" %POS_URL%
    goto :done
)

echo   [✗] لم يتم العثور على متصفح مدعوم!
echo   يرجى تثبيت Google Chrome أو Microsoft Edge
pause
goto :eof

:done
echo   [✓] تم فتح نقطة البيع بنجاح
echo.
echo   ملاحظة: تأكد من ان الطابعة الحرارية هي الطابعة الافتراضية
echo   (Default Printer) في اعدادات Windows
echo.
timeout /t 5 >nul
