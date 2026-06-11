@echo off
REM ollama_dashboard.bat — open the THERMYNX Ollama monitors, each in its own window.
REM
REM   Window 1  VRAM monitor    (what models are loaded)  -> ollama_monitor.bat (+ logs to ollama_vram.log)
REM   Window 2  Client monitor  (who is connected)        -> ollama_who.ps1
REM
REM Assumes Ollama is already running. To (re)start Ollama, use ollama_restart_tuned.bat.
REM grafana_cli.bat is NOT needed on this box (it's for the Docker/Grafana obs host).
title THERMYNX - Ollama Dashboard launcher

start "THERMYNX - VRAM Monitor"   "%~dp0ollama_monitor.bat"
start "THERMYNX - Ollama Clients" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ollama_who.ps1"

echo Opened two windows: VRAM monitor + client monitor.
echo (Ollama server itself: run ollama_restart_tuned.bat.)
