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

REM ============================================================================
REM  THERMYNX final model team (eval-selected · non-Chinese · on-prem)
REM  Role            Model                    Maker      ~VRAM   When loaded
REM  --------------  -----------------------  ---------  ------  -----------------
REM  Planner         gemma4:12b               Google     ~8 GB   pre-warmed
REM  Validator/      phi4                     Microsoft  ~9 GB   pre-warmed
REM    Narration/RAG                                              (eval winner 5.0)
REM  Embeddings      nomic-embed-text         Nomic      ~0.3GB  pre-warmed (RAG)
REM  Executor        devstral:latest          Mistral    ~14 GB  on demand (agent)
REM  NL->SQL         codestral:latest         Mistral    ~13 GB  on demand
REM  Default/fallbk  mistral-small3.2:latest  Mistral    ~15 GB  on demand
REM  Vision          llama3.2-vision          Meta       ~8 GB   on demand
REM
REM  Requires Ollama >= 0.30.7  (0.30.6 ran gemma4 but crashed phi4 = 0xc0000409;
REM  0.30.7 runs BOTH — do not auto-upgrade past a tested build without re-checking).
REM  Backend role->model map lives in backend/app/config.py + backend/.env.
REM ============================================================================

:START
cls
echo.
echo %CYA%================================================================%C0%
echo %CYA%   %BLD%OLLAMA TUNED RESTART%C0%%CYA%   ·   GPU + KV-cache + hot model set   %C0%
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

REM  *** phi4 crash fallback ***
REM  If phi4 fails to load with 0xc0000409 under the tuned env below, the cause is
REM  almost always flash-attention or the quantized KV cache. Flip these two and
REM  re-run (costs a little VRAM headroom but is rock-solid):
REM      set OLLAMA_FLASH_ATTENTION=0
REM      set OLLAMA_KV_CACHE_TYPE=f16

REM  ── VRAM tiers ─ THERMYNX models are 8-15 GB each (far bigger than the old set).
REM     Pre-warmed set = phi4 + gemma4:12b + nomic  (~17 GB, the analyzer + multi-agent
REM     + RAG hot path). The 24B specialists (devstral/codestral/mistral-small3.2) and
REM     vision load on demand and rotate the LRU slot.
REM
REM       48 GB+  -> 5 : also keep devstral + codestral hot (no cold-load anywhere)
REM       24 GB   -> 3 : phi4 + gemma4 + nomic hot; one 24B specialist warms alongside
REM       20 GB   -> 3 : phi4 + gemma4 + nomic hot; a 24B specialist evicts on demand  (THIS BOX)
REM       16 GB   -> 2 : phi4 + nomic only; gemma4 + every specialist cold-load
REM       12 GB   -> 1 : single model; set OLLAMA_DEFAULT_MODEL to a smaller model
set OLLAMA_MAX_LOADED_MODELS=3

REM  Concurrent requests per loaded model. Each parallel slot adds KV cache, so on the
REM  tight 20 GB box keep this at 1; bump to 2 on the 48 GB box for more throughput.
set OLLAMA_NUM_PARALLEL=1

set OLLAMA_DEBUG=0

echo        %MAG%OLLAMA_HOST%C0%               = %WHT%%OLLAMA_HOST%%C0%
echo        %MAG%OLLAMA_ORIGINS%C0%            = %WHT%%OLLAMA_ORIGINS%%C0%
echo        %MAG%OLLAMA_FLASH_ATTENTION%C0%    = %GRN%%OLLAMA_FLASH_ATTENTION%%C0%   %DIM%(faster attention)%C0%
echo        %MAG%OLLAMA_KV_CACHE_TYPE%C0%      = %GRN%%OLLAMA_KV_CACHE_TYPE%%C0% %DIM%(2x VRAM headroom)%C0%
echo        %MAG%OLLAMA_KEEP_ALIVE%C0%         = %GRN%%OLLAMA_KEEP_ALIVE%%C0%  %DIM%(no cold-start)%C0%
echo        %MAG%OLLAMA_MAX_LOADED_MODELS%C0%  = %GRN%%OLLAMA_MAX_LOADED_MODELS%%C0%    %DIM%(phi4 + gemma4:12b + nomic hot)%C0%
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
    echo        %DIM%phi4            (validator / narration / RAG)  ...%C0%
    curl -s --max-time 90 -X POST http://localhost:11434/api/generate ^
        -H "Content-Type: application/json" ^
        -d "{\"model\":\"phi4\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1,\"temperature\":0}}" >nul 2>&1
    echo        %DIM%gemma4:12b      (planner)                      ...%C0%
    curl -s --max-time 90 -X POST http://localhost:11434/api/generate ^
        -H "Content-Type: application/json" ^
        -d "{\"model\":\"gemma4:12b\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1,\"temperature\":0}}" >nul 2>&1
    echo        %DIM%nomic-embed-text (RAG embeddings)              ...%C0%
    curl -s --max-time 30 -X POST http://localhost:11434/api/embeddings ^
        -H "Content-Type: application/json" ^
        -d "{\"model\":\"nomic-embed-text\",\"prompt\":\"ok\"}" >nul 2>&1
    echo.

    echo %CYA%--- Loaded models (expect phi4 + gemma4:12b + nomic warm in VRAM) ---%C0%
    ollama ps
    echo.

    REM  phi4 crash guard: if phi4 is NOT in `ollama ps`, the tuned env likely killed it.
    ollama ps | findstr /I "phi4" >nul
    if !errorlevel! NEQ 0 (
        echo %RED%   WARNING: phi4 did not stay loaded.%C0%
        echo %RED%   Likely the 0xc0000409 crash under flash-attention / q8_0 KV cache.%C0%
        echo %YLW%   Fix: set OLLAMA_FLASH_ATTENTION=0 and OLLAMA_KV_CACHE_TYPE=f16 above, re-run.%C0%
        echo %DIM%   (Until then the backend falls back to mistral-small3.2 for those roles.)%C0%
        echo.
    )

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

    echo %YLW%[8/8]%C0% %GRN%%BLD%Ready.%C0%  Hot models pre-warmed — analyzer / multi-agent / RAG start fast.
    echo        %DIM%devstral / codestral / mistral-small3.2 / llama3.2-vision load on demand.%C0%
    echo        %DIM%THERMYNX per-task model map: backend/app/config.py (OLLAMA_MODEL_*) + backend/.env%C0%
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
