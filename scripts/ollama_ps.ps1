# ollama_ps.ps1 — show which Ollama models are loaded in VRAM (the `ollama ps` view).
#
# Usage:
#   On the Ollama box:   .\scripts\ollama_ps.ps1
#   From another machine:.\scripts\ollama_ps.ps1 -Base "http://100.125.103.28:11434"
#
# THERMYNX only uses: phi4, codestral, devstral, gemma4, nomic-embed-text.
# Anything else loaded (e.g. gpt-oss, mxbai) is an external client sharing the box
# and eating VRAM — on a 20 GB box that forces THERMYNX's models to evict/cold-load.
param([string]$Base = "http://localhost:11434")

Write-Host "`n== LOADED IN VRAM (running now) ==" -ForegroundColor Cyan
try {
    $ps = Invoke-RestMethod -Uri "$Base/api/ps" -TimeoutSec 8
    if (-not $ps.models) {
        Write-Host "  (none loaded)" -ForegroundColor DarkGray
    } else {
        $ps.models | Select-Object `
            name,
            @{N = 'VRAM_GB';      E = { [math]::Round($_.size_vram / 1GB, 2) } },
            @{N = 'Until_Unload'; E = { try { '{0:n1} min' -f ((([datetimeoffset]$_.expires_at).UtcDateTime - [datetime]::UtcNow).TotalMinutes) } catch { $_.expires_at } } } |
            Format-Table -AutoSize
    }
} catch {
    Write-Host "  Ollama unreachable at $Base : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "== THERMYNX uses: phi4, codestral, devstral, gemma4, nomic-embed-text ==" -ForegroundColor DarkGray
Write-Host "   Anything else (e.g. gpt-oss, mxbai) = an external client sharing the box.`n" -ForegroundColor DarkGray
