@echo off
setlocal EnableDelayedExpansion

echo =========================================
echo  Solitaire Web - Single-File Build
echo =========================================
echo.

cd /d "%~dp0"

set RELEASE_DIR=release
set OUT_FILE=index.html
set TMP_BUNDLE=%TEMP%\solitaire_bundle_%RANDOM%.js

:: Step 1: TypeScript type-check (esbuild does the real transpile)
echo [1/4] Type-checking (tsc)...
call tsc --noEmit
if errorlevel 1 (
    echo        tsc reported errors; aborting.
    exit /b 1
)
echo        OK

:: Step 2: Bundle all modules into one IIFE (esbuild)
echo [2/4] Bundling JS (esbuild)...
call npx --yes esbuild src\main.ts --bundle --format=iife --target=es2020 --outfile="%TMP_BUNDLE%"
if errorlevel 1 (
    echo        esbuild failed; aborting.
    exit /b 1
)
echo        OK

:: Step 3: Inline images / css / js into a single index.html
echo [3/4] Inlining assets...
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
call node build-inline.cjs "%TMP_BUNDLE%" "index.html" "css\style.css" "img" "%RELEASE_DIR%\%OUT_FILE%"
if errorlevel 1 (
    echo        inlining failed; aborting.
    exit /b 1
)
del "%TMP_BUNDLE%" >nul 2>nul
echo        OK

:: Step 4: Summary
echo [4/4] Done.
echo =========================================
echo  Build complete:
echo    %CD%\%RELEASE_DIR%\%OUT_FILE%  (self-contained, no external files)
echo =========================================
echo.

pause
endlocal
