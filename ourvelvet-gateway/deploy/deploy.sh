#!/bin/bash
# Deploy OurVelvet Gateway v1. Uso: deploy.sh <TS> (pacchetto estratto in /root/gw-pkg). Backup + nginx -t + rollback.
set -euo pipefail
TS="$1"; PKG=/root/gw-pkg; B=/var/backups/gateway/$TS
mkdir -p $B
NG=/etc/nginx/sites-enabled/ourvelvet.online; OVI=/var/www/ourvelvet/index.html; RIV=/var/www/rivista/index.html; ZXI=/var/www/zx-store/index.html
cp -a $NG $B/ourvelvet.online.nginx; cp -a $OVI $B/ourvelvet-index.html; cp -a $RIV $B/rivista-index.html; cp -a $ZXI $B/zx-store-index.html
cat > $B/rollback.sh <<RB
#!/bin/bash
# Rollback OurVelvet Gateway ($TS). Ripristina nginx e i tre index (menu/widget), ferma e disabilita zdos-gateway.
# I dati (/var/lib/zdos-gateway) vengono spostati in $B/dati-al-rollback, non cancellati.
set -e
systemctl disable --now zdos-gateway 2>/dev/null || true
cp -a $B/ourvelvet.online.nginx $NG
cp -a $B/ourvelvet-index.html $OVI; cp -a $B/rivista-index.html $RIV; cp -a $B/zx-store-index.html $ZXI
rm -f /etc/nginx/snippets/zdos-gateway.conf /etc/nginx/snippets/zdos-gateway-admin-key.conf /etc/systemd/system/zdos-gateway.service
rm -rf /var/www/ourvelvet/gateway /var/www/ourvelvet/gateway-staff /opt/zdos-gateway
systemctl daemon-reload
[ -d /var/lib/zdos-gateway ] && mv /var/lib/zdos-gateway $B/dati-al-rollback || true
nginx -t && systemctl reload nginx
echo "Rollback gateway $TS completato"
RB
chmod 700 $B/rollback.sh

# utente di servizio
id zdosgateway >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin zdosgateway
# codice
mkdir -p /opt/zdos-gateway/node_modules
cp $PKG/server/server.mjs $PKG/server/catalog.mjs $PKG/server/filter.mjs $PKG/server/package.json /opt/zdos-gateway/
for m in better-sqlite3 bindings file-uri-to-path; do cp -a /opt/zdos-social/node_modules/$m /opt/zdos-gateway/node_modules/; done
chown -R root:root /opt/zdos-gateway; chmod -R go-w /opt/zdos-gateway
# chiave admin (solo nginx e servizio)
mkdir -p /etc/zdos-gateway; chmod 750 /etc/zdos-gateway; chgrp zdosgateway /etc/zdos-gateway
if [ ! -s /etc/zdos-gateway/admin.key ]; then umask 077; openssl rand -hex 32 > /etc/zdos-gateway/admin.key; fi
chown root:zdosgateway /etc/zdos-gateway/admin.key; chmod 640 /etc/zdos-gateway/admin.key
( umask 077; printf 'proxy_set_header X-Gateway-Admin "%s";\n' "$(cat /etc/zdos-gateway/admin.key)" > /etc/nginx/snippets/zdos-gateway-admin-key.conf )
chmod 600 /etc/nginx/snippets/zdos-gateway-admin-key.conf
# servizio
cp $PKG/deploy/zdos-gateway.service /etc/systemd/system/zdos-gateway.service
systemctl daemon-reload; systemctl enable --now zdos-gateway
for i in $(seq 1 20); do curl -sf -m2 127.0.0.1:8912/api/gateway/health >/dev/null && break; sleep 0.5; done
curl -sf -m3 127.0.0.1:8912/api/gateway/health || { echo "servizio non risponde"; journalctl -u zdos-gateway -n 30 --no-pager; exit 1; }
# web
rm -rf /var/www/ourvelvet/gateway /var/www/ourvelvet/gateway-staff
cp -a $PKG/web /var/www/ourvelvet/gateway; cp -a $PKG/staff /var/www/ourvelvet/gateway-staff
chown -R root:root /var/www/ourvelvet/gateway /var/www/ourvelvet/gateway-staff; find /var/www/ourvelvet/gateway /var/www/ourvelvet/gateway-staff -type d -exec chmod 755 {} \; ; find /var/www/ourvelvet/gateway /var/www/ourvelvet/gateway-staff -type f -exec chmod 644 {} \;
# nginx
cp $PKG/deploy/zdos-gateway.conf /etc/nginx/snippets/zdos-gateway.conf
grep -q "zdos-gateway.conf" $NG || sed -i "s#^\(\s*include /etc/nginx/snippets/zdos-pool-party.conf;.*\)#\1\n    include /etc/nginx/snippets/zdos-gateway.conf;  \# OurVelvet Gateway (rollback: $B/rollback.sh)#" $NG
grep -q "zdos-gateway.conf" $NG || { echo "include non inserito"; exit 1; }
# menu e widget (solo voce di menu, banda widget nella sezione Prenota della rivista)
python3 $PKG/deploy/patch_pages.py "$OVI" "$RIV" "$ZXI"
if nginx -t; then systemctl reload nginx; else echo "nginx -t FALLITO: ripristino"; bash $B/rollback.sh; exit 1; fi
echo "DEPLOY_OK $B"
