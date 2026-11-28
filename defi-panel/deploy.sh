#!/bin/bash
# Deploy ZDOS DeFi panel. Uso: bash deploy.sh  (eseguire sul VPS da /root/defi-stage)
set -euo pipefail
TS=$(date +%Y%m%d-%H%M); B=/var/backups/defi-panel/$TS; S=/root/defi-stage
mkdir -p $B/files
tar -czf $B/nginx-etc.tgz -C / etc/nginx
cp -a /var/www/zroute/current/index.html $B/files/zroute-index.html
cp -a /opt/zdos-zbasket-portal/index.html $B/files/basket-index.html
cp -a /var/www/zpool-ai/index.html $B/files/zpool-index.html
cp -a /var/www/x-zdos-portal/current/assets/hub/site-nav.js $B/files/site-nav.js
NG=$(readlink -f /etc/nginx/sites-enabled/x-zdos-unified); cp -a $NG $B/files/x-zdos-unified.conf; echo "$NG" > $B/files/x-zdos-unified.path

# 1) servizio API
install -m 644 $S/server/server.mjs /opt/zdos-defi/server.mjs
install -m 644 $S/server/zdos-defi.service /etc/systemd/system/zdos-defi.service
# 2) pagina statica (release + symlink)
mkdir -p /var/www/defi-panel/releases/$TS && cp -a $S/web/. /var/www/defi-panel/releases/$TS/
ln -sfn /var/www/defi-panel/releases/$TS /var/www/defi-panel/current
chown -R www-data:www-data /var/www/defi-panel
mkdir -p /var/www/zdos-common && install -m 644 -o www-data -g www-data $S/tag/zdos-tag.js /var/www/zdos-common/zdos-tag.js
# 3) nginx
install -m 644 $S/nginx/zdos-defi.conf /etc/nginx/snippets/zdos-defi.conf
install -m 644 $S/tag/zdos-gtag.conf /etc/nginx/snippets/zdos-gtag.conf
grep -q "snippets/zdos-defi.conf" $NG || sed -i "s#^\(\s*include /etc/nginx/snippets/zdos-firma.conf;.*\)#\1\n    include /etc/nginx/snippets/zdos-defi.conf;  \# pannello DeFi unico (rollback: $B/rollback.sh)#" $NG
sed -i 's#location = /zroute { return 301 https://swap.x-zdos.it/zroute/; }#location = /zroute { return 301 /defi/\#swap; }#; s#location ^~ /zroute/ { return 301 https://swap.x-zdos.it/zroute/; }#location ^~ /zroute/ { return 301 /defi/\#swap; }#' $NG
# 4) collegamento dalle vecchie pagine (restano funzionanti) + voce di menu
PILL='<a href="https://x-zdos.it/defi/#TAB" class="zdos-defi-pill" style="position:fixed;right:14px;bottom:14px;z-index:9999;padding:9px 14px;border-radius:999px;background:linear-gradient(135deg,#9b5cff,#ff4fa3);color:#fff;font:600 13px system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 24px rgba(155,92,255,.35)">Nuovo: pannello DeFi unico →</a>'
for pair in "/var/www/zroute/current/index.html:swap" "/opt/zdos-zbasket-portal/index.html:basket" "/var/www/zpool-ai/index.html:pool"; do
  f=${pair%%:*}; tab=${pair##*:}
  grep -q "zdos-defi-pill" "$f" || python3 - "$f" "${PILL/TAB/$tab}" <<'PY'
import sys; f,p=sys.argv[1],sys.argv[2]; s=open(f).read(); i=s.rfind("</body>")
open(f,"w").write(s[:i]+p+"\n"+s[i:] if i>=0 else s+p)
PY
done
python3 - <<'PY'
f="/var/www/x-zdos-portal/current/assets/hub/site-nav.js"; s=open(f).read()
old='{ href: "https://swap.x-zdos.it/zroute/", label: "zRoute", ext: true }'
new='{ href: HOME + "/defi/", label: "DeFi (Swap · Pool · Basket)", match: "^/defi/" },\n      '+old
if '"/defi/"' not in s and old in s: open(f,"w").write(s.replace(old,new,1))
PY
# 5) rollback
cat > $B/rollback.sh <<RB
#!/bin/bash
# Rollback pannello DeFi ($TS)
set -e
systemctl disable --now zdos-defi 2>/dev/null || true
rm -f /etc/systemd/system/zdos-defi.service; systemctl daemon-reload
cp -a $B/files/x-zdos-unified.conf "\$(cat $B/files/x-zdos-unified.path)"
rm -f /etc/nginx/snippets/zdos-defi.conf /etc/nginx/snippets/zdos-gtag.conf
cp -a $B/files/zroute-index.html /var/www/zroute/current/index.html
cp -a $B/files/basket-index.html /opt/zdos-zbasket-portal/index.html
cp -a $B/files/zpool-index.html /var/www/zpool-ai/index.html
cp -a $B/files/site-nav.js /var/www/x-zdos-portal/current/assets/hub/site-nav.js
nginx -t && systemctl reload nginx
pm2 restart zdos-zbasket-portal >/dev/null
echo "Rollback completato. Restano (inerti) /var/www/defi-panel, /var/www/zdos-common, /opt/zdos-defi: rimuoverli a mano se serve."
RB
chmod +x $B/rollback.sh
# 6) verifica e attivazione
if nginx -t 2>&1; then systemctl reload nginx; else echo "nginx -t FALLITO: ripristino"; bash $B/rollback.sh; exit 1; fi
systemctl daemon-reload; systemctl enable --now zdos-defi; systemctl restart zdos-defi
pm2 restart zdos-zbasket-portal >/dev/null
echo "DEPLOY OK $TS backup=$B"
