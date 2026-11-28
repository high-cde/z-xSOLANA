#!/bin/bash
# Rollback OurVelvet Social (20261128-1314). Ripristina nginx, creator-hub e zcomm; ferma e disabilita zdos-social.
# I dati del servizio (/var/lib/zdos-social) vengono spostati in /var/backups/social/20261128-1314/dati-al-rollback, non cancellati.
set -e
B=/var/backups/social/20261128-1314
systemctl disable --now zdos-social 2>/dev/null || true
cp -a $B/ourvelvet.online.nginx /etc/nginx/sites-enabled/ourvelvet.online
cp -a $B/ourvelvet-velvet-pages.conf /etc/nginx/snippets/ourvelvet-velvet-pages.conf
rm -f /etc/nginx/snippets/zdos-social.conf /etc/nginx/snippets/zdos-social-admin-key.conf
rm -rf /var/www/ourvelvet/creator-hub && tar -C /var/www/ourvelvet -xzf $B/creator-hub.tgz
rm -rf /var/www/ourvelvet/creator-admin
cp -a $B/lib.mjs $B/server.mjs /opt/zcomm/ && systemctl restart zcomm
[ -d /var/lib/zdos-social ] && mv /var/lib/zdos-social $B/dati-al-rollback || true
nginx -t && systemctl reload nginx
echo "Rollback social 20261128-1314 completato"
