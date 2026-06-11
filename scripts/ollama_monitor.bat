@echo off
REM ollama_monitor.bat — live "what's loaded in VRAM" monitor.
REM Re-runs ollama_ps.ps1 every 5 seconds in this window.
REM
REM   Double-click (or run) for a monitor window, or it auto-opens at the end of
REM   ollama_restart_tuned.bat. Close the window to stop.
REM
REM Note: only useful on an ATTENDED desktop. For a headless server, log to a
REM file instead (see ollama_ps.ps1 header / the file-logging snippet in docs).
title THERMYNX - Ollama VRAM Monitor
powershell -NoProfile -ExecutionPolicy Bypass -Command "while($true){ Clear-Host; & '%~dp0ollama_ps.ps1'; Start-Sleep -Seconds 5 }"
