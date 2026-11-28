#!/bin/bash
# Rollback ZLang Launcher (__TS__). Toglie SOLO la riga include aggiunta (non tocca modifiche altrui),
# rimuove snippet e pagine. Copia integrale della config pre-modifica: /var/backups/launcher/__TS__/x-zdos-unified
set -e
F=/etc/nginx/sites-enabled/x-zdos-unified
cp -a $F /var/backups/launcher/__TS__/x-zdos-unified.pre-rollback
sed -i '/include \/etc\/nginx\/snippets\/zdos-launcher.conf;/d' $F
rm -f /etc/nginx/snippets/zdos-launcher.conf
rm -rf /var/www/zlang-launcher
nginx -t && systemctl reload nginx
echo "rollback launcher completato"
