#!/bin/bash
# Rollback Z-Sound (20261128-1511). Ripristina file e nginx, toglie la pagina e l'adattatore AI, riavvia zdos-social.
# NON ripristina il database: le colonne aggiunte (media.mime/title/dur, posts.audio) sono innocue e i dati dei creator non si toccano.
set -e
B=/var/backups/zsound/20261128-1511/files
cp -a $B/server.mjs /opt/zdos-social/server.mjs
rm -f /opt/zdos-social/zsound-ai.mjs /opt/zdos-social/test-zsound.mjs /opt/zdos-social/test-zsound-ai.mjs
cp -a $B/creator-hub/. /var/www/ourvelvet/creator-hub/
cp -a $B/creator-admin/. /var/www/ourvelvet/creator-admin/
cat $B/home-index.html > /var/www/ourvelvet/index.html
cp -a $B/ourvelvet.online.nginx $(cat $B/nginx-realpath)
rm -f /etc/nginx/snippets/zdos-zsound.conf
rm -rf /var/www/ourvelvet/z-sound
nginx -t && systemctl reload nginx
systemctl restart zdos-social
sleep 2; curl -s http://127.0.0.1:8910/api/social/health; echo
echo "rollback Z-Sound completato (config AI /etc/zdos-social/zsound-ai.json lasciata: spenta e senza chiavi)"
