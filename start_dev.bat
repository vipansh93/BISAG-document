@echo off
title TERRA·WATCH — Dev Servers
echo.
echo  =========================================================
echo    TERRA·WATCH — Starting Backend + Frontend
echo  =========================================================
echo.

echo [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "TERRA·WATCH Backend" cmd /k "cd /d "%~dp0backend" && pip install -r requirements.txt -q && uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting React frontend on http://localhost:5173 ...
start "TERRA·WATCH Frontend" cmd /k "cd /d "%~dp0streamlit-satellite-change-detection" && npm install && npm run dev"

echo.
echo  Both servers starting...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo  API docs: http://localhost:8000/docs
echo.
pause
