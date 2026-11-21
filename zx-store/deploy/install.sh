#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
TS=$(date +%Y%m%d-%H%M%S)
B=/var/backups/zxstore-beta/$TS
SRC=/tmp/zxstore-beta-incoming
WEB=/var/www/zxstore-beta

mkdir -p "$B/nginx" "$B/www" "$WEB/.well-known/acme-challenge"

# Backup configurazione nginx (sola copia, nessun file esistente viene modificato)
cp -a /etc/nginx/nginx.conf "$B/nginx/"
cp -a /etc/nginx/sites-available "$B/nginx/sites-available"
cp -a /etc/nginx/sites-enabled "$B/nginx/sites-enabled"
if [ -d "$WEB" ] && [ "$(ls -A "$WEB" 2>/dev/null || true)" ]; then
  tar -C /var/www -czf "$B/www/zxstore-beta-prev.tar.gz" zxstore-beta || true
fi
if [ -f /etc/nginx/sites-available/zxstore-beta ]; then
  cp -a /etc/nginx/sites-available/zxstore-beta "$B/nginx/zxstore-beta.prev"
fi
if [ -f /etc/systemd/system/zxstore-beta.service ]; then
  cp -a /etc/systemd/system/zxstore-beta.service "$B/nginx/zxstore-beta.service.prev"
fi

# Rollback: ripristina solo ciò che riguarda beta, non tocca gli altri vhost
cat > "$B/rollback.sh" << ROLL
#!/bin/bash
set -euo pipefail
echo "Rollback beta $TS"
if [ -f "$B/nginx/zxstore-beta.prev" ]; then
  cp -a "$B/nginx/zxstore-beta.prev" /etc/nginx/sites-available/zxstore-beta
elif [ ! -f /etc/letsencrypt/live/beta.x-zdos.it/fullchain.pem ]; then
  rm -f /etc/nginx/sites-enabled/zxstore-beta /etc/nginx/sites-available/zxstore-beta
else
  # tieni il vhost (altrimenti beta.x-zdos.it ricade su velvet.x-zdos.it)
  echo "Nessun vhost precedente: il vhost beta resta attivo. Per togliere il sito usa i file in $B"
fi
if [ -f "$B/www/zxstore-beta-prev.tar.gz" ]; then
  rm -rf /var/www/zxstore-beta
  tar -C /var/www -xzf "$B/www/zxstore-beta-prev.tar.gz"
fi
if [ -f "$B/nginx/zxstore-beta.service.prev" ]; then
  cp -a "$B/nginx/zxstore-beta.service.prev" /etc/systemd/system/zxstore-beta.service
  systemctl daemon-reload
  systemctl restart zxstore-beta
else
  systemctl stop zxstore-beta 2>/dev/null || true
fi
nginx -t
systemctl reload nginx
echo "Rollback completato. Backup: $B"
ROLL
chmod 700 "$B/rollback.sh"

# Pubblica i file (career/ escluso già dal pacchetto)
mkdir -p "$WEB"
# rimuovi solo contenuti del sito, non il webroot
find "$WEB" -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +
tar -C "$SRC" --exclude=_deploy -cf - . | tar -C "$WEB" -xf -
mkdir -p "$WEB/.well-known/acme-challenge"
chown -R www-data:www-data "$WEB"
find "$WEB" -type d -exec chmod 755 {} +
find "$WEB" -type f -exec chmod 644 {} +

# Credenziali: crea solo se mancano. Non stampa la password.
if [ ! -f /etc/nginx/htpasswd-beta ]; then
  umask 077
  PW=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)
  htpasswd -cb /etc/nginx/htpasswd-beta doc "$PW" >/dev/null
  chown root:www-data /etc/nginx/htpasswd-beta
  chmod 640 /etc/nginx/htpasswd-beta
  printf '%s\n' "URL: https://beta.x-zdos.it" "utente: doc" "password: $PW" "creato: $(date -Iseconds) (Europe/Rome)" "nota: accesso riservato a doc — non pubblicare in chat o nei post" > /root/BETA-ACCESS.txt
  chmod 600 /root/BETA-ACCESS.txt
  unset PW
  echo "CREDENZIALI: scritte in /root/BETA-ACCESS.txt (non stampate)."
else
  echo "CREDENZIALI: /etc/nginx/htpasswd-beta già presente, non sovrascritto."
  if [ ! -f /root/BETA-ACCESS.txt ]; then
    echo "ATTENZIONE: htpasswd esiste già ma manca /root/BETA-ACCESS.txt (non rigenero la password)."
  fi
fi

# Servizio Node (solo localhost)
cp -a "$SRC/_deploy/zxstore-beta.service" /etc/systemd/system/zxstore-beta.service
systemctl daemon-reload
systemctl enable --now zxstore-beta
sleep 1
systemctl --no-pager --full status zxstore-beta | head -20

# Nginx: prima HTTP per ACME se manca il certificato
if [ ! -f /etc/letsencrypt/live/beta.x-zdos.it/fullchain.pem ]; then
  cp -a "$SRC/_deploy/zxstore-beta.http.nginx" /etc/nginx/sites-available/zxstore-beta
  ln -sfn /etc/nginx/sites-available/zxstore-beta /etc/nginx/sites-enabled/zxstore-beta
  nginx -t
  systemctl reload nginx
  certbot certonly --webroot -w "$WEB" -d beta.x-zdos.it --non-interactive --agree-tos --keep-until-expiring
fi

# Nginx: vhost HTTPS completo (file nuovo, nessun altro blocco modificato)
cp -a "$SRC/_deploy/zxstore-beta.nginx" /etc/nginx/sites-available/zxstore-beta
ln -sfn /etc/nginx/sites-available/zxstore-beta /etc/nginx/sites-enabled/zxstore-beta
nginx -t
systemctl reload nginx

# Verifiche senza stampare la password
NOAUTH=$(curl -sI -m 15 -o /tmp/zx-h-noauth -w '%{http_code}' https://beta.x-zdos.it/ || true)
AUTH=$(python3 - << 'PY'
import subprocess
from pathlib import Path
text = Path("/root/BETA-ACCESS.txt").read_text()
user = next(l.split(":",1)[1].strip() for l in text.splitlines() if l.startswith("utente:"))
pw = next(l.split(":",1)[1].strip() for l in text.splitlines() if l.startswith("password:"))
r = subprocess.run(["curl","-sI","-m","15","-o","/tmp/zx-h-auth","-w","%{http_code}","-u",f"{user}:{pw}","https://beta.x-zdos.it/"], capture_output=True, text=True)
print(r.stdout.strip() or "000")
PY
)
ROBOTS=$(curl -sI -m 15 -o /tmp/zx-h-robots -w '%{http_code}' https://beta.x-zdos.it/robots.txt || true)
CERT=$(echo | openssl s_client -servername beta.x-zdos.it -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -subject -dates -ext subjectAltName 2>/dev/null | tr '\n' ' ')

echo "==== RISULTATO ===="
echo "backup=$B"
echo "http_senza_auth=$NOAUTH"
echo "https_con_auth=$AUTH"
echo "robots_noauth=$ROBOTS"
echo "cert=$CERT"
echo "--- headers noauth ---"
grep -iE 'HTTP/|www-authenticate|x-robots|location|strict' /tmp/zx-h-noauth || true
echo "--- headers auth ---"
grep -iE 'HTTP/|x-robots|content-type|content-length' /tmp/zx-h-auth || true
echo "--- title (auth, no password printed) ---"
python3 - << 'PY'
import subprocess, re
from pathlib import Path
text = Path("/root/BETA-ACCESS.txt").read_text()
user = next(l.split(":",1)[1].strip() for l in text.splitlines() if l.startswith("utente:"))
pw = next(l.split(":",1)[1].strip() for l in text.splitlines() if l.startswith("password:"))
r = subprocess.run(["curl","-s","-m","15","-u",f"{user}:{pw}","https://beta.x-zdos.it/"], capture_output=True, text=True)
html = r.stdout
m = re.search(r"<title>(.*?)</title>", html, re.I|re.S)
print("title:", m.group(1).strip() if m else "(nessun title)")
print("noindex_meta:", "noindex" in html)
print("discord_new:", "4CGZrAAxaq" in html)
print("old_discord_absent:", "9fDdURTevG" not in html)
print("telegram:", "OurVelvetHub" in html)
print("dsn_sol:", "35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4" in html)
print("dsn_poly:", "0xfc90516a1f736FaC557e09D8853dB80dA192c296" in html)
PY
echo "--- api grok health (atteso 401 senza auth, 503 con auth e senza chiave) ---"
echo -n "api_noauth="; curl -sI -m 10 -o /dev/null -w '%{http_code}' https://beta.x-zdos.it/api/grok/health; echo
python3 - << 'PY'
import subprocess
from pathlib import Path
text = Path("/root/BETA-ACCESS.txt").read_text()
user = next(l.split(":",1)[1].strip() for l in text.splitlines() if l.startswith("utente:"))
pw = next(l.split(":",1)[1].strip() for l in text.splitlines() if l.startswith("password:"))
r = subprocess.run(["curl","-s","-m","10","-u",f"{user}:{pw}","https://beta.x-zdos.it/api/grok/health"], capture_output=True, text=True)
print("api_auth_body:", r.stdout.strip()[:200])
r2 = subprocess.run(["curl","-s","-m","10","-u",f"{user}:{pw}","https://beta.x-zdos.it/api/starlink"], capture_output=True, text=True)
print("starlink_source:", ("mock" in r2.stdout and "source") or r2.stdout[:120])
print("starlink_snippet:", r2.stdout[:180].replace("\n"," "))
PY
echo "OK install $TS"
