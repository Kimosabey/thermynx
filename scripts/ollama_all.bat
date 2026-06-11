@echo off
setlocal enabledelayedexpansion
title THERMYNX - Ollama ALL-IN-ONE

REM ===========================================================================
REM  ollama_all.bat  —  ONE self-contained file. Does everything:
REM    (re)start Ollama tuned -> pre-warm hot models -> open 2 monitor windows.
REM  No other scripts needed (monitors are inlined). Copy this one file anywhere.
REM  Tuned for a 20 GB GPU. Requires Ollama >= 0.30.7.
REM  THERMYNX models: phi4, codestral, devstral, gemma4, nomic-embed-text.
REM ===========================================================================

echo [1/6] Killing existing Ollama...
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
set OLLAMA_KEEP_ALIVE=30m
set OLLAMA_MAX_LOADED_MODELS=3
set OLLAMA_NUM_PARALLEL=1

echo [3/6] Starting Ollama server in its own window...
start "OLLAMA SERVER" cmd /k "ollama serve"
timeout /t 6 >nul

echo [4/6] Verifying API on http://localhost:11434 ...
curl -s --max-time 5 http://localhost:11434/api/tags >nul 2>&1
if !errorlevel! neq 0 echo    (not up yet - monitors will show 'unreachable' until it responds)

echo [5/6] Pre-warming hot models (phi4 + gemma4:12b + nomic-embed-text)...
curl -s --max-time 90 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"phi4\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" >nul 2>&1
curl -s --max-time 90 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"gemma4:12b\",\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" >nul 2>&1
curl -s --max-time 30 -X POST http://localhost:11434/api/embeddings -H "Content-Type: application/json" -d "{\"model\":\"nomic-embed-text\",\"prompt\":\"ok\"}" >nul 2>&1

echo [6/6] Opening monitors (VRAM + clients) in separate windows...
start "THERMYNX - VRAM Monitor" powershell -NoProfile -ExecutionPolicy Bypass -Command "$log=Join-Path $env:USERPROFILE 'Desktop\ollama_vram.log'; while(1){ Clear-Host; '== LOADED IN VRAM (refresh 5s) =='; try { $m=(Invoke-RestMethod 'http://localhost:11434/api/ps' -TimeoutSec 8).models; if($m){ $m | Format-Table name,@{N='VRAM_GB';E={[math]::Round($_.size_vram/1GB,1)}} -AutoSize | Out-Host; $n=($m.name) -join ', ' } else { '  (none loaded)'; $n='' } } catch { '  Ollama unreachable'; $n='unreachable' }; ('{0}  {1}' -f (Get-Date).ToString('HH:mm:ss'),$n) | Out-File -Append -Encoding utf8 $log; Start-Sleep 5 }"
start "THERMYNX - Ollama Clients" powershell -NoProfile -ExecutionPolicy Bypass -Command "while(1){ Clear-Host; '== Clients on :11434  (EXTERNAL = sharing your GPU) =='; $c=Get-NetTCPConnection -LocalPort 11434 -State Established -EA SilentlyContinue | Select-Object RemoteAddress,OwningProcess -Unique; if(-not $c){ '  (no active connections)' } else { $c | ForEach-Object { '{0,-22} pid {1}  {2}' -f $_.RemoteAddress, $_.OwningProcess, $(if($_.RemoteAddress -in '127.0.0.1','::1','0.0.0.0'){'local'}else{'EXTERNAL'}) } }; Start-Sleep 5 }"

echo.
echo Done. Ollama running + VRAM/clients monitors open.  History -^> %USERPROFILE%\Desktop\ollama_vram.log
echo (grafana_cli.bat is not needed on this box.)
endlocal
