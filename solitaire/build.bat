@echo off
chcp 65001 > nul
setlocal

echo ============================================
echo  Solitaire Web - Release Build
echo ============================================

set RELEASE_DIR=release

:: ── 1. TypeScript 컴파일 ────────────────────────────────────
echo.
echo [1/3] TypeScript 컴파일 중...
call npx tsc
if errorlevel 1 (
    echo [ERROR] TypeScript 컴파일 실패
    pause
    exit /b 1
)
echo       완료.

:: ── 2. release 폴더 초기화 ──────────────────────────────────
echo.
echo [2/3] release 폴더 생성 중...
if exist "%RELEASE_DIR%" (
    rd /s /q "%RELEASE_DIR%"
)
mkdir "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%\css"
mkdir "%RELEASE_DIR%\dist"
mkdir "%RELEASE_DIR%\img"

:: ── 3. 파일 복사 (소스맵·소스코드 제외) ────────────────────
echo.
echo [3/3] 파일 복사 중...

:: HTML
copy /y "index.html" "%RELEASE_DIR%\index.html" > nul

:: CSS
copy /y "css\style.css" "%RELEASE_DIR%\css\style.css" > nul

:: JS (소스맵 .map 제외)
for %%f in (dist\*.js) do (
    copy /y "%%f" "%RELEASE_DIR%\dist\" > nul
)

:: 이미지
xcopy /y /q "img\*" "%RELEASE_DIR%\img\" > nul

echo       완료.

:: ── 결과 출력 ───────────────────────────────────────────────
echo.
echo ============================================
echo  빌드 완료: %RELEASE_DIR%\
echo ============================================
echo.
echo  포함된 항목:
echo    index.html
echo    css\style.css
echo    dist\*.js   (소스맵 제외)
echo    img\*
echo.

endlocal
pause
