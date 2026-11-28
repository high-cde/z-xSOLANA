#!/bin/bash
# Rollback sezione Creator (creator-hub). Ripristina lo snippet nginx originale e rimuove la nuova cartella.
set -e
D=$(cd "$(dirname "$0")" && pwd)
cp -a $D/ourvelvet-velvet-pages.conf /etc/nginx/snippets/ourvelvet-velvet-pages.conf
nginx -t
systemctl reload nginx
rm -rf /var/www/ourvelvet/creator-hub
echo "Rollback creator completato: /creator-radar/ torna al gioco Radar originale."
