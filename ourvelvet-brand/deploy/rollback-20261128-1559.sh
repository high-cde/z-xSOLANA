#!/bin/bash
# Rollback restyle Dom-Coin & Velvet by ZDOS + TikTok (20261128-1559). Ripristina i file di prima, toglie i file nuovi, riavvia zdos-social.
# Attenzione: ripristinando le pagine tornano come erano alle ore 20261128-1559 (eventuali OG tag aggiunti dopo vanno rifatti).
set -e
tar xzf /var/backups/restyle/20261128-1559/files.tgz -C /
rm -f /var/www/ourvelvet/assets/velvet-zdos.css /var/www/ourvelvet/assets/vz-ov.png /var/www/ourvelvet/assets/vz-coin.png /var/www/ourvelvet/assets/vz-tiktok.js /var/www/ourvelvet/assets/velvet-skin.js
rm -rf /var/www/ourvelvet/privacy /var/www/ourvelvet/termini
rm -f /opt/zdos-social/tiktok.mjs /opt/zdos-social/test-tiktok.mjs
sed -i '/zdos-legal.conf/d' /etc/nginx/sites-enabled/ourvelvet.online
rm -f /etc/nginx/snippets/zdos-legal.conf
nginx -t && systemctl reload nginx
systemctl restart zdos-social
echo "rollback 20261128-1559 completato (/etc/zdos-social/tiktok.* lasciati: senza il codice non fanno nulla)"
