#!/usr/bin/env bash
# Deploy xCLOUD MVP statico su https://x-zdos.it/xcloud/ con backup e rollback.
set -euo pipefail
TS="$(date +%Y%m%d-%H%M%S)"; SRC="$(cd "$(dirname "$0")" && pwd)"
B="/var/backups/xcloud/$TS"; mkdir -p "$B"
CONF=/etc/nginx/sites-available/x-zdos-it-nuovo
cp -a "$CONF" "$B/x-zdos-it-nuovo.conf"
readlink -f /var/www/x-zdos-portal/current > "$B/portal-current.txt"
(readlink -f /var/www/xcloud/current 2>/dev/null || true) > "$B/xcloud-current.txt"
# 1) release statica xcloud
REL="/var/www/xcloud/releases/$TS-mvp"; mkdir -p "$REL"; cp -a "$SRC/xcloud/." "$REL/"
chown -R www-data:www-data /var/www/xcloud; find "$REL" -type d -exec chmod 755 {} +; find "$REL" -type f -exec chmod 644 {} +
ln -sfn "$REL" /var/www/xcloud/current.tmp && mv -Tf /var/www/xcloud/current.tmp /var/www/xcloud/current
# 2) rollback script (scritto prima di toccare nginx)
cat > "$B/rollback.sh" <<RB
#!/usr/bin/env bash
set -e
cp -a "$B/x-zdos-it-nuovo.conf" "$CONF" && nginx -t && systemctl reload nginx
ln -sfn "\$(cat "$B/portal-current.txt")" /var/www/x-zdos-portal/current.tmp && mv -Tf /var/www/x-zdos-portal/current.tmp /var/www/x-zdos-portal/current
PREV="\$(cat "$B/xcloud-current.txt")"; if [ -n "\$PREV" ]; then ln -sfn "\$PREV" /var/www/xcloud/current; else rm -f /var/www/xcloud/current; fi
echo "Rollback xCLOUD $TS completato"
RB
chmod 700 "$B/rollback.sh"; ln -sfn "$B/rollback.sh" "/var/backups/xcloud/rollback-xcloud-$TS.sh"
# 3) nginx: solo nuova location /xcloud/ (idempotente)
if ! grep -q 'location \^~ /xcloud/' "$CONF"; then
python3 - "$CONF" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
blk='''    # xCLOUD by ZDOS - gestionale MVP (statico, dati solo nel browser)
    location = /xcloud { return 301 /xcloud/; }
    location ^~ /xcloud/ {
        alias /var/www/xcloud/current/;
        index index.html;
        types { text/html html; text/css css; application/javascript js; image/svg+xml svg; application/manifest+json webmanifest; }
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Permissions-Policy "geolocation=(self), camera=(), microphone=()" always;
        add_header Cache-Control "no-cache" always;
    }

    location / {'''
a='\n    location / {'
assert s.count(a)==1, 'anchor'
s=s.replace(a,'\n'+blk,1)
open(p,'w').write(s)
PY
fi
if ! nginx -t 2>"$B/nginx-t.log"; then cat "$B/nginx-t.log"; cp -a "$B/x-zdos-it-nuovo.conf" "$CONF"; echo "nginx -t fallito: config ripristinata"; exit 1; fi
systemctl reload nginx
# 4) portale: nuova release con link xCLOUD
PREL="/var/www/x-zdos-portal/releases/$TS-xcloud"; cp -a "$(cat "$B/portal-current.txt")" "$PREL"
cp "$SRC/portal-index.html" "$PREL/index.html"; cp "$SRC/portal-index.html" "$PREL/hub.html"; chown -R www-data:www-data "$PREL"
ln -sfn "$PREL" /var/www/x-zdos-portal/current.tmp && mv -Tf /var/www/x-zdos-portal/current.tmp /var/www/x-zdos-portal/current
echo "OK $TS  rollback: bash /var/backups/xcloud/rollback-xcloud-$TS.sh"
