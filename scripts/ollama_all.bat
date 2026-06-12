@echo off
setlocal enabledelayedexpansion
title THERMYNX - Ollama ALL-IN-ONE

REM ===========================================================================
REM  ollama_all.bat  —  ONE self-contained file. Does everything:
REM    (re)start Ollama tuned -> pre-warm hot models -> open 2 monitor windows.
REM  No other scripts needed (monitors are inlined). Copy this one file anywhere.
REM  Tuned for a 20 GB GPU. Requires Ollama >= 0.30.7.
REM  THERMYNX models: phi4, codestral, devstral, gemma4, nomic-embed-text.
REM
REM  20 GB REALITY (read this): the working set does NOT all fit at once -
REM    phi4 ~9 GB + devstral ~15 GB = 24 GB > 20 GB. So models ROTATE (cold-load
REM    ~10-20s on each cross-model switch). You can keep the ANALYZE set warm
REM    (phi4 + gemma4 + nomic = ~16 GB) OR the AGENT model (devstral) - NOT both.
REM    The real fix is a 48 GB box. Until then:
REM      * Do NOT run the full eval/golden suite against this box while demoing
REM        (it floods + thrashes the GPU).
REM      * Keep OLLAMA_NUM_PARALLEL=1 (no concurrent generations on one GPU).
REM ===========================================================================

echo [1/6] Killing existing Ollama (clears ALL VRAM - clean slate)...
taskkill /F /IM ollama.exe >nul 2>&1
taskkill /F /IM "Ollama App.exe" >nul 2>&1
sc stop Ollama >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :11434 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul

echo [2/6] Setting tuned env vars...
set OLLAMA_HOST=0.0.0.0
set OLLAMA_ORIGINS=*
set OLLAMA_FLASH_ATTENTION=1
set OLLAMA_KV_CACHE_TYPE=q8_0
REM KEEP_ALIVE was 30m -> dropped to 10m. On 20 GB a big model (devstral ~15 GB)
REM pinned 30m BLOCKS phi4 from loading (24 GB > 20 GB) and wedges the box after a
REM burst. 10m still keeps models warm through a demo but releases VRAM far sooner
REM so the box self-recovers. (NOTE: the backend graph also sends a per-request
REM keep_alive via config.py OLLAMA_KEEP_ALIVE - keep the two in sync.)
set OLLAMA_KEEP_ALIVE=10m
REM Cap loaded models at 2 (was 3): on 20 GB you can't actually hold 3 big models;
REM trying to wedges the GPU. 2 lets the analyze pair (phi4 + nomic) stay resident
REM while big models rotate cleanly.
set OLLAMA_MAX_LOADED_MODELS=2
set OLLAMA_NUM_PARALLEL=1

echo [3/6] Starting Ollama server in its own window...
start "OLLAMA SERVER" cmd /k "ollama serve"
timeout /t 6 >nul

echo [4/6] Verifying API on http://localhost:11434 ...
curl -s --max-time 5 http://localhost:11434/api/tags >nul 2>&1
if !errorlevel! neq 0 echo    (not up yet - monitors will show 'unreachable' until it responds)

echo [5/6] Pre-warming the ANALYZE set (phi4 + nomic-embed-text) + planner (gemma4:12b)...
REM This warm set targets the Analyze/RAG demo (phi4) + orchestrator planning (gemma4).
REM devstral (agent tool model, ~15 GB) is intentionally NOT warmed - it won't co-fit
REM with phi4 on 20 GB. If you're DEMOING AGENTS first, comment the gemma4 line and
REM uncomment the devstral line instead (you still can't have phi4 + devstral together).
curl -s --max-time 90 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"phi4\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" >nul 2>&1
curl -s --max-time 30 -X POST http://localhost:11434/api/embeddings -H "Content-Type: application/json" -d "{\"model\":\"nomic-embed-text\",\"prompt\":\"ok\"}" >nul 2>&1
curl -s --max-time 90 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"gemma4:12b\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" >nul 2>&1
REM curl -s --max-time 90 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"devstral\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" >nul 2>&1

echo    Currently loaded in VRAM:
curl -s --max-time 8 http://localhost:11434/api/ps

echo [6/6] Opening monitors (VRAM + clients) in separate windows...
start "THERMYNX - VRAM Monitor" powershell -NoProfile -ExecutionPolicy Bypass -Command "$log=Join-Path $env:USERPROFILE 'Desktop\ollama_vram.log'; while(1){ Clear-Host; '== LOADED IN VRAM (refresh 5s) =='; try { $m=(Invoke-RestMethod 'http://localhost:11434/api/ps' -TimeoutSec 8).models; if($m){ $m | Format-Table name,@{N='VRAM_GB';E={[math]::Round($_.size_vram/1GB,1)}} -AutoSize | Out-Host; $n=($m.name) -join ', ' } else { '  (none loaded)'; $n='' } } catch { '  Ollama unreachable'; $n='unreachable' }; ('{0}  {1}' -f (Get-Date).ToString('HH:mm:ss'),$n) | Out-File -Append -Encoding utf8 $log; Start-Sleep 5 }"
start "THERMYNX - Ollama Clients" powershell -NoProfile -ExecutionPolicy Bypass -Command "while(1){ Clear-Host; '== Clients on :11434  (EXTERNAL = sharing your GPU) =='; $c=Get-NetTCPConnection -LocalPort 11434 -State Established -EA SilentlyContinue | Select-Object RemoteAddress,OwningProcess -Unique; if(-not $c){ '  (no active connections)' } else { $c | ForEach-Object { '{0,-22} pid {1}  {2}' -f $_.RemoteAddress, $_.OwningProcess, $(if($_.RemoteAddress -in '127.0.0.1','::1','0.0.0.0'){'local'}else{'EXTERNAL'}) } }; Start-Sleep 5 }"

echo.
echo Done. Ollama running + VRAM/clients monitors open.  History -^> %USERPROFILE%\Desktop\ollama_vram.log
echo If a model still won't load: re-run this file (the kill in step 1 is the reset).
endlocal
