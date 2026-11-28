#!/bin/bash
# Rollback OurVelvet Gateway (20261128-1515). Ripristina nginx e i tre index (menu/widget), ferma e disabilita zdos-gateway.
# I dati (/var/lib/zdos-gateway) vengono spostati in /var/backups/gateway/20261128-1515/dati-al-rollback, non cancellati.
set -e
systemctl disable --now zdos-gateway 2>/dev/null || true
cp -a /var/backups/gateway/20261128-1515/ourvelvet.online.nginx /etc/nginx/sites-enabled/ourvelvet.online
cp -a /var/backups/gateway/20261128-1515/ourvelvet-index.html /var/www/ourvelvet/index.html; cp -a /var/backups/gateway/20261128-1515/rivista-index.html /var/www/rivista/index.html; cp -a /var/backups/gateway/20261128-1515/zx-store-index.html /var/www/zx-store/index.html
rm -f /etc/nginx/snippets/zdos-gateway.conf /etc/nginx/snippets/zdos-gateway-admin-key.conf /etc/systemd/system/zdos-gateway.service
rm -rf /var/www/ourvelvet/gateway /var/www/ourvelvet/gateway-staff /opt/zdos-gateway
systemctl daemon-reload
[ -d /var/lib/zdos-gateway ] && mv /var/lib/zdos-gateway /var/backups/gateway/20261128-1515/dati-al-rollback || true
nginx -t && systemctl reload nginx
echo "Rollback gateway 20261128-1515 completato"
