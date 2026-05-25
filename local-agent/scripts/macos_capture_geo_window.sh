#!/bin/bash
# 将「GEO 本地发布客户端」窗口截图到仓库 artifacts/（需客户端已打开且授予屏幕录制权限）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/artifacts"
mkdir -p "$OUT"

osascript <<'APPLESCRIPT' || true
tell application "System Events"
  repeat with proc in (every process whose background only is false)
    if name of proc contains "Electron" or name of proc contains "GEO" then
      repeat with w in (every window of proc)
        if name of w contains "GEO" then
          set frontmost of proc to true
          perform action "AXRaise" of w
          exit repeat
        end if
      end repeat
    end if
  end repeat
end tell
APPLESCRIPT

sleep 0.8
screencapture -x "$OUT/agent-ui-client-window.png" 2>/dev/null || screencapture "$OUT/agent-ui-client-window.png"
echo "[ok] $OUT/agent-ui-client-window.png"
