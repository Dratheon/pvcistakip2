@echo off
echo ========================================
echo   Is Takip Paneli - Development Server
echo ========================================
echo.

:: Frontend'i yeni terminal penceresinde baslat
echo [1/2] Frontend baslatiliyor (http://localhost:5173)...
start "Frontend - Vite" cmd /k "cd md.web && npm run dev"

:: 2 saniye bekle
timeout /t 2 /nobreak > nul

:: Backend'i yeni terminal penceresinde baslat
echo [2/2] Backend baslatiliyor (http://localhost:8000)...
start "Backend - FastAPI" cmd /k "cd md.service && py -m uvicorn app.main:app --reload --port 8000"

echo.
echo ========================================
echo   Sunucular baslatildi!
echo ========================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Hot Reload AKTIF - Kod degisiklikleriniz
echo   otomatik olarak yansiyacak!
echo.
echo   Durdurmak icin terminal pencerelerini kapatin.
echo ========================================









