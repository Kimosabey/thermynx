@echo off
REM ollama_monitor.bat — live VRAM monitor + rolling log.
REM Shows the loaded-models view (ollama_ps.ps1) refreshed every 5s AND appends one
REM timestamped line per cycle to %USERPROFILE%\Desktop\ollama_vram.log (history).
REM
REM   Double-click to run, or it auto-opens at the end of ollama_restart_tuned.bat.
REM   Read history:  Get-Content "$env:USERPROFILE\Desktop\ollama_vram.log" -Tail 30 -Wait
REM   Must sit next to ollama_ps.ps1 (called via %~dp0). Close the window to stop.
REM
REM Note: attended-desktop tool. On a headless server, run just the logging loop
REM (no Clear-Host) so it writes the file without needing a visible window.
title THERMYNX - Ollama VRAM Monitor
powershell -NoProfile -ExecutionPolicy Bypass -Command "$log = Join-Path $env:USERPROFILE 'Desktop\ollama_vram.log'; while($true){ Clear-Host; & '%~dp0ollama_ps.ps1'; $n = try { ((Invoke-RestMethod 'http://localhost:11434/api/ps').models.name) -join ', ' } catch { 'unreachable' }; ('{0}  {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $n) | Out-File -Append -Encoding utf8 $log; Start-Sleep -Seconds 5 }"
