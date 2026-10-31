#!/usr/bin/env bash
# تثبيت أو تحديث خدمة إزالة الخلفية على الخادم. يُشغَّل كـ root بعد wasit-deploy (يسحب المستودع إلى /opt/wasit):
#   bash /opt/wasit/ShoppingPlatformAPI/bgremove/install.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST=/opt/wasit-bgremove

export DEBIAN_FRONTEND=noninteractive
dpkg -s python3-venv >/dev/null 2>&1 || apt-get install -y -qq python3-venv
id wasit-bg >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin wasit-bg
mkdir -p "$DEST/models"
[ -d "$DEST/venv" ] || python3 -m venv "$DEST/venv"
"$DEST/venv/bin/pip" install -q --upgrade pip
"$DEST/venv/bin/pip" install -q "rembg[cpu]" fastapi "uvicorn[standard]" python-multipart
install -m 644 "$SRC/app.py" "$DEST/app.py"
# النموذج يُنزَّل مرة واحدة الآن لا عند أول طلب
U2NET_HOME="$DEST/models" "$DEST/venv/bin/python" -c "from rembg import new_session; new_session('isnet-general-use')" >/dev/null
chown -R wasit-bg:wasit-bg "$DEST"
install -m 644 "$SRC/wasit-bgremove.service" /etc/systemd/system/wasit-bgremove.service
systemctl daemon-reload
systemctl enable wasit-bgremove >/dev/null 2>&1
systemctl restart wasit-bgremove
for _ in $(seq 1 40); do curl -sf 127.0.0.1:7010/health && echo && break; sleep 2; done
systemctl is-active wasit-bgremove
