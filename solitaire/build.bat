@echo off
chcp 65001 > nul
setlocal

echo ============================================
echo  Solitaire Web - Release Build
echo ============================================

set RELEASE_DIR=release

:: ── 1. TypeScript compile ──────────────────────────────────
echo.
echo [1/3] TypeScript compile...
call npx tsc
if errorlevel 1 (
    echo [ERROR] TypeScript compile failed
    pause
    exit /b 1
)
echo       Done.

:: ── 2. Init release folder ────────────────────────────────
echo.
echo [2/3] Creating release folder...
if exist "%RELEASE_DIR%" (
    rd /s /q "%RELEASE_DIR%"
)
mkdir "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%\css"
mkdir "%RELEASE_DIR%\dist"
mkdir "%RELEASE_DIR%\img"

:: ── 3. Copy files (exclude source maps) ───────────────────
echo.
echo [3/3] Copying files...

:: HTML
copy /y "index.html" "%RELEASE_DIR%\index.html" > nul

:: CSS
copy /y "css\style.css" "%RELEASE_DIR%\css\style.css" > nul

:: JS (exclude .map files)
for %%f in (dist\*.js) do (
    copy /y "%%f" "%RELEASE_DIR%\dist\" > nul
)

:: Images
xcopy /y /q "img\*" "%RELEASE_DIR%\img\" > nul

echo       Done.

:: ── Result ────────────────────────────────────────────────
echo.
echo ============================================
echo  Build complete: %RELEASE_DIR%\
echo ============================================
echo.
echo  Contents:
echo    index.html
echo    css\style.css
echo    dist\*.js   (no source maps)
echo    img\*
echo.

endlocal
pause
