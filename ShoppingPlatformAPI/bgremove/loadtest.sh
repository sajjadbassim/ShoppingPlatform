#!/usr/bin/env bash
# قياس على الخادم: طلب واحد ثم N طلباً متزامناً بصورة منتج حقيقية من المرفوعات (لا يغيّر شيئاً)
#   bash /opt/wasit/ShoppingPlatformAPI/bgremove/loadtest.sh [N=30] [max_side=0]
set -euo pipefail
N="${1:-30}"; SIDE="${2:-0}"
IMG="$(find /opt/wasit-api/wwwroot/uploads -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -size +150k -printf '%s %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)"
[ -n "$IMG" ] || { echo "no test image found"; exit 1; }
echo "image: $IMG ($(du -h "$IMG" | cut -f1)), max_side=$SIDE"
URL="http://127.0.0.1:7010/remove?max_side=$SIDE"
fmt='%{http_code} total=%{time_total}s queue=%header{x-queue-ms}ms process=%header{x-process-ms}ms size=%{size_download}\n'
echo "--- single"; curl -s -o /dev/null -w "$fmt" -F "file=@$IMG;type=image/jpeg" "$URL"
echo "--- $N concurrent"
start=$(date +%s.%N)
seq "$N" | xargs -P "$N" -I{} curl -s -o /dev/null -w "$fmt" -F "file=@$IMG;type=image/jpeg" "$URL" | sort -t= -k2 -n > /tmp/bg-load.txt
end=$(date +%s.%N)
head -3 /tmp/bg-load.txt; echo "..."; tail -3 /tmp/bg-load.txt
echo "ok: $(grep -c '^200' /tmp/bg-load.txt)/$N  wall=$(awk "BEGIN{printf \"%.1f\", $end - $start}")s"
echo "--- memory"; systemctl show wasit-bgremove -p MemoryCurrent
