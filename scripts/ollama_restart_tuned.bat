@echo off
setlocal enabledelayedexpansion
title OLLAMA TUNED RESTART

REM ── Enable ANSI escape colors in cmd ───────────────────────────────────────
for /f "delims=" %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C0=%ESC%[0m"
set "BLD=%ESC%[1m"
set "RED=%ESC%[91m"
set "GRN=%ESC%[92m"
set "YLW=%ESC%[93m"
set "BLU=%ESC%[94m"
set "MAG=%ESC%[95m"
set "CYA=%ESC%[96m"
set "WHT=%ESC%[97m"
set "DIM=%ESC%[90m"

:START
cls
echo.
echo %CYA%================================================================%C0%
echo %CYA%   %BLD%OLLAMA TUNED RESTART%C0%%CYA%   ·   GPU + KV-cache + 3-model hot   %C0%
echo %CYA%================================================================%C0%
echo.

echo %YLW%[1/8]%C0% Killing Ollama processes...
taskkill /F /IM ollama.exe >nul 2>&1
taskkill /F /IM "Ollama App.exe" >nul 2>&1

echo %YLW%[2/8]%C0% Stopping Ollama Windows service (if installed)...
sc stop Ollama >nul 2>&1

echo %YLW%[3/8]%C0% Freeing port 11434...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :11434 2^>nul') do (
    echo        %DIM%killed PID %%a%C0%
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 >nul

echo %YLW%[4/8]%C0% Double-checking port...
netstat -ano | findstr :11434 >nul
if !errorlevel!==0 (
    echo        %RED%port still busy, retrying cleanup...%C0%
    timeout /t 2 >nul
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :11434 2^>nul') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
timeout /t 2 >nul

echo %YLW%[5/8]%C0% %BLD%Setting performance env vars%C0%...
set OLLAMA_HOST=0.0.0.0
set OLLAMA_ORIGINS=*
set OLLAMA_FLASH_ATTENTION=1
set OLLAMA_KV_CACHE_TYPE=q8_0
set OLLAMA_KEEP_ALIVE=30m

REM MAX_LOADED_MODELS sized for the THERMYNX per-task model fan-out:
REM   qwen2.5:14b      ~9 GB  (analyzer/agent narration, orchestrator synth)
REM   llama3.1:8b      ~5 GB  (agent tool selection, NL-SQL, planner)
REM   llama3.2:latest  ~2 GB  (self-critique auditor)
REM   Sum hot:         ~16 GB with KV q8_0
REM
REM   Vision (llama3.2-vision ~8 GB) + embeddings (nomic-embed-text ~0.3 GB)
REM   load on demand and rotate the LRU slot.
REM
REM   GPU VRAM tier:
REM     24 GB+  → keep 3 (recommended; eliminates swap thrash)
REM     16 GB   → 3 still fits with KV q8_0; tight but works
REM     12 GB   → drop to 2 (accept NL-SQL cold-load every ~5 min)
REM     8 GB    → drop to 1 + use OLLAMA_DEFAULT_MODEL=llama3.1:8b for everything
set OLLAMA_MAX_LOADED_MODELS=3

REM NUM_PARALLEL: concurrent requests per loaded model. Higher = more throughput
REM but more VRAM per model. Stay at 2 unless you have spare VRAM headroom.
set OLLAMA_NUM_PARALLEL=2

set OLLAMA_DEBUG=0

echo        %MAG%OLLAMA_HOST%C0%               = %WHT%%OLLAMA_HOST%%C0%
echo        %MAG%OLLAMA_ORIGINS%C0%            = %WHT%%OLLAMA_ORIGINS%%C0%
echo        %MAG%OLLAMA_FLASH_ATTENTION%C0%    = %GRN%%OLLAMA_FLASH_ATTENTION%%C0%   %DIM%(faster attention)%C0%
echo        %MAG%OLLAMA_KV_CACHE_TYPE%C0%      = %GRN%%OLLAMA_KV_CACHE_TYPE%%C0% %DIM%(2x VRAM headroom)%C0%
echo        %MAG%OLLAMA_KEEP_ALIVE%C0%         = %GRN%%OLLAMA_KEEP_ALIVE%%C0%  %DIM%(no cold-start)%C0%
echo        %MAG%OLLAMA_MAX_LOADED_MODELS%C0%  = %GRN%%OLLAMA_MAX_LOADED_MODELS%%C0%    %DIM%(qwen2.5:14b + llama3.1:8b + llama3.2 hot)%C0%
echo        %MAG%OLLAMA_NUM_PARALLEL%C0%       = %GRN%%OLLAMA_NUM_PARALLEL%%C0%
echo        %MAG%OLLAMA_DEBUG%C0%              = %DIM%%OLLAMA_DEBUG%%C0%
echo.

echo %YLW%[6/8]%C0% Starting Ollama server in a new window...
start "OLLAMA SERVER" cmd /k "ollama serve"
timeout /t 6 >nul

echo %YLW%[7/8]%C0% Verifying API on http://localhost:11434 ...
curl -s --max-time 5 http://localhost:11434/api/tags >nul 2>&1
if !errorlevel!==0 (
    echo.
    echo %GRN%================================================================%C0%
    echo %GRN%      %BLD%OLLAMA RUNNING%C0%%GRN%   ·   TUNED CONFIG ACTIVE%C0%
    echo %GRN%================================================================%C0%
    echo.

    echo %CYA%--- Pre-warming hot model set (single short call per model) ---%C0%
    echo        %DIM%qwen2.5:14b   ...%C0%
    curl -s --max-time 60 -X POST http://localhost:11434/api/generate ^
        -H "Content-Type: application/json" ^
        -d "{\"model\":\"qwen2.5:14b\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1,\"temperature\":0}}" >nul 2>&1
    echo        %DIM%llama3.1:8b   ...%C0%
    curl -s --max-time 60 -X POST http://localhost:11434/api/generate ^
        -H "Content-Type: application/json" ^
        -d "{\"model\":\"llama3.1:8b\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1,\"temperature\":0}}" >nul 2>&1
    echo        %DIM%llama3.2      ...%C0%
    curl -s --max-time 60 -X POST http://localhost:11434/api/generate ^
        -H "Content-Type: application/json" ^
        -d "{\"model\":\"llama3.2:latest\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1,\"temperature\":0}}" >nul 2>&1
    echo.

    echo %CYA%--- Loaded models (should show 3 warm in VRAM) ---%C0%
    ollama ps
    echo.

    echo %CYA%--- Endpoints ---%C0%
    echo   %WHT%Local   :%C0% http://localhost:11434
    for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /C:"IPv4"') do (
        set "ip=%%i"
        set "ip=!ip:~1!"
        echo   %WHT%Network :%C0% http://!ip!:11434
    )
    echo.

    echo %CYA%--- GPU snapshot ---%C0%
    where nvidia-smi >nul 2>&1
    if !errorlevel!==0 (
        nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader
    ) else (
        echo   %DIM%nvidia-smi not on PATH — skipping GPU snapshot%C0%
    )
    echo.

    echo %YLW%[8/8]%C0% %GRN%%BLD%Ready.%C0%  All 3 hot models pre-warmed — first backend call should be fast.
    echo        %DIM%THERMYNX per-task model mapping is in backend/app/config.py (commit 5f8b38e+).%C0%
    echo.
) else (
    echo.
    echo %RED%================================================================%C0%
    echo %RED%       %BLD%START FAILED%C0%%RED%   ·   retrying in 3s...                  %C0%
    echo %RED%================================================================%C0%
    echo.
    timeout /t 3 >nul
    goto START
)

echo %DIM%Press any key to close this window. Ollama keeps running in its own.%C0%
pause >nul
endlocal
