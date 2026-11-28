set -e
TS=$(date +%Y%m%d-%H%M); B=/var/backups/pool-party/$TS-web; mkdir -p $B/nginx
cp -a /etc/nginx/sites-enabled/ourvelvet.online $B/nginx/ourvelvet.online
cp -a /var/www/x-zdos-portal/current/assets/hub/site-nav.js $B/site-nav.js
cp -a /var/www/ourvelvet/index.html $B/ourvelvet-index.html
ls /var/www/ourvelvet/pool-party >/dev/null 2>&1 && cp -a /var/www/ourvelvet/pool-party $B/pool-party.prev || true
NAV=$(readlink -f /var/www/x-zdos-portal/current/assets/hub/site-nav.js)
cat > $B/rollback.sh <<EOF
#!/bin/bash
# rollback Pool Party (pagina + nginx + menu). Backup: $B
set -e
cp -a $B/nginx/ourvelvet.online /etc/nginx/sites-enabled/ourvelvet.online
rm -f /etc/nginx/snippets/zdos-pool-party.conf
cp -a $B/site-nav.js $NAV
cp -a $B/ourvelvet-index.html /var/www/ourvelvet/index.html
rm -rf /var/www/ourvelvet/pool-party
nginx -t && systemctl reload nginx
echo rollback web ok
EOF
chmod +x $B/rollback.sh
mkdir -p /var/www/ourvelvet/pool-party; cp /tmp/pp-index.html /var/www/ourvelvet/pool-party/index.html; chown -R www-data:www-data /var/www/ourvelvet/pool-party
cat > /etc/nginx/snippets/zdos-pool-party.conf <<'EOF'
# Pool Party inverso (sola lettura) · pagina statica; API in /api/social/pool/ (zdos-social). Rollback: /var/backups/pool-party/<ts>-web/rollback.sh
location = /pool-party { return 301 /pool-party/; }
location ^~ /pool-party/ {
    alias /var/www/ourvelvet/pool-party/;
    index index.html;
}
EOF
grep -q zdos-pool-party /etc/nginx/sites-enabled/ourvelvet.online || python3 - <<'PY'
p="/etc/nginx/sites-enabled/ourvelvet.online";s=open(p).read()
k="    include /etc/nginx/snippets/zdos-social.conf;"
i=s.index(k);j=s.index("\n",i)
s=s[:j+1]+"    include /etc/nginx/snippets/zdos-pool-party.conf;  # Pool Party (rollback: /var/backups/pool-party/)\n"+s[j+1:]
open(p,"w").write(s)
PY
grep -q "Pool Party" $NAV || python3 - "$NAV" <<'PY'
import sys;p=sys.argv[1];s=open(p).read()
a='      { href: "https://ourvelvet.online/merito/", label: "Miner merito", ext: true },\n'
assert a in s
s=s.replace(a,a+'      { href: "https://ourvelvet.online/pool-party/", label: "Pool Party (proposta)", ext: true },\n',1);open(p,'w').write(s)
PY
grep -q "/pool-party/" /var/www/ourvelvet/index.html || python3 - <<'PY'
p="/var/www/ourvelvet/index.html";s=open(p).read()
a='<a class="menu-item" href="https://ourvelvet.online/merito/"><span>⛏️ Miner merito</span><span>→</span></a>\n'
assert a in s
s=s.replace(a,a+'  <a class="menu-item" href="https://ourvelvet.online/pool-party/"><span>🎉 Pool Party (proposta)</span><span>→</span></a>\n',1);open(p,'w').write(s)
PY
nginx -t && systemctl reload nginx && echo DEPLOY_OK $B
