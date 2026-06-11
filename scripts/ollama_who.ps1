# ollama_who.ps1 — live list of clients connected to Ollama (:11434).
# An EXTERNAL client (any address that isn't this box) is sharing your GPU —
# e.g. the gpt-oss / mxbai workload that thrashes phi4 out of the 20 GB card.
#
#   Run:  powershell -ExecutionPolicy Bypass -File .\ollama_who.ps1
#   Or it's opened automatically by ollama_dashboard.bat.
param([int]$Refresh = 5)

while ($true) {
    Clear-Host
    Write-Host "== Clients connected to Ollama :11434  (refresh ${Refresh}s) ==" -ForegroundColor Cyan
    $conns = Get-NetTCPConnection -LocalPort 11434 -State Established -ErrorAction SilentlyContinue |
             Select-Object RemoteAddress, OwningProcess -Unique
    if (-not $conns) {
        Write-Host "  (no active connections right now)" -ForegroundColor DarkGray
    } else {
        foreach ($c in $conns) {
            $isLocal = $c.RemoteAddress -in @('127.0.0.1', '::1', '0.0.0.0')
            $tag   = if ($isLocal) { 'local' } else { 'EXTERNAL  <-- sharing your GPU' }
            $color = if ($isLocal) { 'DarkGray' } else { 'Yellow' }
            Write-Host ("  {0,-22} pid {1,-7} {2}" -f $c.RemoteAddress, $c.OwningProcess, $tag) -ForegroundColor $color
        }
    }
    Write-Host "`n  Cross-check with the VRAM monitor: if gpt-oss/mxbai is loaded AND an EXTERNAL" -ForegroundColor DarkGray
    Write-Host "  address shows here, that's the client to stop (or point at another box)." -ForegroundColor DarkGray
    Start-Sleep -Seconds $Refresh
}
