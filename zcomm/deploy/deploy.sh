#!/bin/bash
# Deploy miner merito + zcomm. Backup completo e rollback.sh in /var/backups/merito/<ts>/.
set -euo pipefail
P=$(cd "$(dirname "$0")" && pwd)
TS=$(date +%Y%m%d-%H%M%S); B=/var/backups/merito/$TS; mkdir -p "$B"
echo "backup in $B"
# --- backup ---
cp -a /etc/nginx/sites-enabled/velvethub "$B/velvethub.nginx"
cp -a /etc/nginx/sites-enabled/x-zdos-unified "$B/x-zdos-unified.nginx"
cp -a /etc/zdos-fondo-merito/config.json "$B/fondo-config.json"
cp -a /var/www/velvethub/dist/public/badge/index.html "$B/badge-index.html"
readlink /var/www/x-zdos-portal/current > "$B/xzdos-current.txt"
readlink /var/www/zlang-dev/current > "$B/zlangdev-current.txt"
mkdir -p "$B/zdiscord" "$B/zara" "$B/tg"
cp -a /opt/zdiscord/src/{ecosystem.js,commands.js,index.js} "$B/zdiscord/"
cp -a /opt/zara-bot/{ecosystem.js,zara.js} "$B/zara/"
cp -a /opt/ourvelvet/app/api/eco_tg.py "$B/tg/"
cat > "$B/rollback.sh" <<RB
#!/bin/bash
# Rollback miner merito/zcomm del $TS. Non tocca i dati del Radar, di zNFT o di ZQuest.
set -e
touch /etc/zdos-fondo-merito/STOP
systemctl disable --now zcomm-payout.timer 2>/dev/null || true
systemctl disable --now zcomm.service 2>/dev/null || true
cp -a $B/fondo-config.json /etc/zdos-fondo-merito/config.json
cp -a $B/velvethub.nginx /etc/nginx/sites-enabled/velvethub
cp -a $B/x-zdos-unified.nginx /etc/nginx/sites-enabled/x-zdos-unified
rm -f /etc/nginx/snippets/velvet-merito.conf /etc/nginx/snippets/xzdos-merito.conf
cp -a $B/badge-index.html /var/www/velvethub/dist/public/badge/index.html
ln -sfn \$(cat $B/xzdos-current.txt) /var/www/x-zdos-portal/current
ln -sfn \$(cat $B/zlangdev-current.txt) /var/www/zlang-dev/current
cp -a $B/zdiscord/* /opt/zdiscord/src/
cp -a $B/zara/* /opt/zara-bot/
cp -a $B/tg/eco_tg.py /opt/ourvelvet/app/api/eco_tg.py
nginx -t && systemctl reload nginx
systemctl restart zdiscord zara-bot ourvelvet
echo "rollback completato (il registro /var/lib/zcomm resta per verifica; STOP presente)"
RB
chmod 700 "$B/rollback.sh"

# --- zcomm ---
getent group zcomm >/dev/null || groupadd --system zcomm
mkdir -p /opt/zcomm /var/lib/zcomm /etc/zcomm
cp -a "$P"/zcomm/{lib.mjs,server.mjs,payout.mjs,package.json,package-lock.json,kill-switch.sh} /opt/zcomm/
chown root:root /opt/zcomm/*.mjs /opt/zcomm/package*.json /opt/zcomm/kill-switch.sh; chmod 644 /opt/zcomm/*.mjs; chmod 700 /opt/zcomm/kill-switch.sh
(cd /opt/zcomm && npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1)
if [ ! -s /etc/zcomm/hmac.key ]; then (umask 027; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > /etc/zcomm/hmac.key; echo >> /etc/zcomm/hmac.key); fi
chown root:zcomm /etc/zcomm /etc/zcomm/hmac.key; chmod 750 /etc/zcomm; chmod 640 /etc/zcomm/hmac.key; chmod 700 /var/lib/zcomm
id -nG zdiscord | grep -qw zcomm || usermod -aG zcomm zdiscord
cp "$P"/zcomm/zcomm.service "$P"/zcomm/zcomm-payout.service "$P"/zcomm/zcomm-payout.timer /etc/systemd/system/
# --- config fondo (emissioni attive, t399u/t400u) ---
python3 "$P/make-config.py" "$B/fondo-config.json" /etc/zdos-fondo-merito/config.json.new
python3 -c "import json;json.load(open('/etc/zdos-fondo-merito/config.json.new'))"
mv /etc/zdos-fondo-merito/config.json.new /etc/zdos-fondo-merito/config.json
chmod 644 /etc/zdos-fondo-merito/config.json
systemctl daemon-reload
systemctl enable --now zcomm.service
sleep 4; curl -sf http://127.0.0.1:4192/zcomm/api/health

# --- siti ---
R=/var/www/merito/releases/$TS; mkdir -p "$R"; cp -r "$P"/site/merito/. "$R/"; chown -R root:root /var/www/merito; chmod -R a+rX /var/www/merito; ln -sfn "$R" /var/www/merito/current
cp "$P/web/badge-index.html" /var/www/velvethub/dist/public/badge/index.html
XR=/var/www/x-zdos-portal/releases/$TS-merito; cp -a "$(readlink /var/www/x-zdos-portal/current)" "$XR"; cp "$P/web/xzdos-index.html" "$XR/index.html"; ln -sfn "$XR" /var/www/x-zdos-portal/current
DR=/var/www/zlang-dev/releases/$TS-merito; cp -a "$(readlink /var/www/zlang-dev/current)" "$DR"
python3 - "$DR/monete/index.html" <<'PY'
import sys,re
p=sys.argv[1];s=open(p,encoding="utf8").read()
s=s.replace("<dt>Conti con saldo</dt><dd>6 (rilevato il 21/11/2026 alle 15:41 (ora di Roma))</dd>","<dt>Conti con saldo</dt><dd>7 su 10 conti token (rilevato il 21/11/2026 alle 20:40, ora di Roma) · <a href=\"https://velvet.x-zdos.it/merito/#ov\" rel=\"noopener\">dato live</a></dd>")
old="Gettone di comunità di OurVelvet, senza alcun rendimento."
assert old in s
s=s.replace(old,"Gettone di comunità di OurVelvet e moneta ufficiale delle Mistress, senza alcun rendimento. Usi: premi merito per contributi reali (attivi, dal fondo con tetto), ruoli holder su Discord, zNFT (in prova su devnet), stanze e tip ai creator (in arrivo). Dettagli e dati live sul <a href=\"https://velvet.x-zdos.it/merito/#ov\" rel=\"noopener\">miner merito</a>.",1)
open(p,"w",encoding="utf8").write(s)
PY
chown -R www-data:www-data "$DR"; ln -sfn "$DR" /var/www/zlang-dev/current

# --- nginx ---
cp "$P"/zcomm/velvet-merito.conf /etc/nginx/snippets/velvet-merito.conf
cp "$P"/zcomm/xzdos-merito.conf /etc/nginx/snippets/xzdos-merito.conf; chmod 644 /etc/nginx/snippets/velvet-merito.conf /etc/nginx/snippets/xzdos-merito.conf
grep -q "velvet-merito.conf" /etc/nginx/sites-enabled/velvethub || sed -i 's#    include /etc/nginx/snippets/velvet-znft.conf;#    include /etc/nginx/snippets/velvet-znft.conf;\n    include /etc/nginx/snippets/velvet-merito.conf;#' /etc/nginx/sites-enabled/velvethub
grep -q "xzdos-merito.conf" /etc/nginx/sites-enabled/x-zdos-unified || sed -i '0,/    location = \/dev { return 301 \/dev\/; }/s##    include /etc/nginx/snippets/xzdos-merito.conf;\n    location = /dev { return 301 /dev/; }#' /etc/nginx/sites-enabled/x-zdos-unified
if nginx -t 2>&1; then systemctl reload nginx; else echo "nginx -t FALLITO: ripristino"; cp -a "$B/velvethub.nginx" /etc/nginx/sites-enabled/velvethub; cp -a "$B/x-zdos-unified.nginx" /etc/nginx/sites-enabled/x-zdos-unified; exit 1; fi

# --- bot ---
cp "$P"/bots/zdiscord/* /opt/zdiscord/src/
cp "$P"/bots/zara/* /opt/zara-bot/
cp "$P"/bots/tg/eco_tg.py /opt/ourvelvet/app/api/eco_tg.py
chown root:root /opt/zdiscord/src/{ecosystem.js,commands.js,index.js,zcomm-client.js} /opt/zara-bot/{ecosystem.js,zara.js} /opt/ourvelvet/app/api/eco_tg.py
chmod 644 /opt/zdiscord/src/{ecosystem.js,commands.js,index.js,zcomm-client.js} /opt/zara-bot/{ecosystem.js,zara.js} /opt/ourvelvet/app/api/eco_tg.py
echo "Poi: systemctl restart zdiscord zara-bot ourvelvet; registra i comandi (register-commands.js, python -m app.api.eco_tg)"
echo "DEPLOY_OK $TS"
