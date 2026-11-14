#!/usr/bin/env bash
# applica-radar.sh v2 — ZDESK tab "Radar" (sola lettura) + Staking (non custodial) + Connetti app.
# Uso (da root, nel tmux "up"):  bash /tmp/applica-radar.sh [/tmp/zdesk-radar.tar.gz]
# Funziona sia dal master originale sia dal Radar v1 di stanotte.
# Non tocca: nginx, htpasswd, ACCESS.txt, copytrader.js, ninja.js, wallet.js, sources.js, chiavi.
# Backup completo in /var/backups/zdesk/ e script di rollback scritto prima di copiare.
set -euo pipefail

TARBALL="${1:-/tmp/zdesk-radar.tar.gz}"
TAR_SHA="a150694221ba0de6eb5ae0a31c9d19a5413be4b171e1b5fbe1f388c38305fcf2"
APP="${ZDESK_APP:-/opt/zdesk}"
DESK="${ZDESK_DESK:-/opt/zdesk/desk}"
BK="${ZDESK_BK:-/var/backups/zdesk}"
SERVICE=zdesk
URL="${ZDESK_URL:-http://127.0.0.1:8787}"
TS="$(date +%Y%m%d-%H%M%S)"
CODE_FILES=(server.js public/index.html public/app.js public/app.css)
LIB_FILES=(lib/radar.js lib/staking.js lib/connect.js lib/solana-ata.js)
# Stato di partenza accettato: master originale (ORIG) oppure Radar v1 (V1).
declare -A ORIG=(
  [server.js]=8ead871a4fbb8c2830a8cf75aec42596d7d9b0ff31d6a68093032526e50fe152
  [public/index.html]=56a125893918c89ea00254da16ee16fa7eef33d43a697be0c2367ff8d28d1c2f
  [public/app.js]=4352ba3570d395eb79f06a1f7be39e862d8145f8d2a904ece2eae198ec2b219d
  [public/app.css]=84884f47620a1527b7ef9174d012c3a2b4d993821bb012f78585b8a09dff0cdf
)
declare -A V1=(
  [server.js]=a5e5896d4be6a3e46b32d8fb4085a9b34918d550351b8ee87dc7685cf52763c1
  [public/index.html]=8d5ee0db5abef95cf5f74fbbd490aaddab012ec92c8ec837973f3272b4a8a926
  [public/app.js]=a15c1927e71fef8ae87b052b4ab2b4099dd21ef75d37bdf77d3171e48bc86d0d
  [public/app.css]=405c4abb510b173ab26b72a32abdd96620f37936669123c293ba074570fff1da
)
declare -A NEW=(
  [server.js]=35147295ed828932022485cd7db26b2588b42349af2f66b8103b4d85a6ce7c69
  [public/index.html]=2b488f867487b498a81a933732cd23a50441d9467c72f846b06a2e4dc6fb6f57
  [public/app.js]=c5cdf32fa422cc4baf2242f8297cc10c1a4fe525a0572fffba51112e1f7bcc60
  [public/app.css]=af5cca00400142f289689eafdc49731b4b1613703499a7137dba5246b2ef165d
)

die() { echo "ESITO KO: $*" >&2; exit 1; }
own() { stat -c %U:%G "$1"; }
sha() { sha256sum "$1" | awk '{print $1}'; }

[ "$(id -u)" = 0 ] || [ "${ZDESK_TEST:-0}" = 1 ] || die "lancia da root"
[ -f "$TARBALL" ] || die "manca $TARBALL"
[ -f "$APP/server.js" ] || die "manca $APP/server.js"
[ -d "$DESK" ] || die "manca $DESK"
command -v node >/dev/null || die "node non trovato"
echo "$TAR_SHA  $TARBALL" | sha256sum -c - >/dev/null || die "sha256 del pacchetto diverso: non applico"
echo "[1/7] pacchetto verificato"

already=1
for f in "${CODE_FILES[@]}"; do [ "$(sha "$APP/$f")" = "${NEW[$f]}" ] || already=0; done
if [ "$already" = 1 ] && [ -f "$APP/lib/staking.js" ]; then
  echo "Radar v2 già applicato: niente da fare."
  curl -fsS -m 10 "$URL/api/radar" >/dev/null && echo "ESITO OK (già presente)"
  exit 0
fi

diff_list=(); from=""
for f in "${CODE_FILES[@]}"; do
  s="$(sha "$APP/$f")"
  if [ "$s" = "${ORIG[$f]}" ]; then from="${from}o"; elif [ "$s" = "${V1[$f]}" ]; then from="${from}1"; else diff_list+=("$f"); fi
done
if [ "${#diff_list[@]}" -gt 0 ] && [ "${FORCE:-0}" != 1 ]; then
  die "questi file sul VPS non sono né il master né il Radar v1: ${diff_list[*]} — mandami l'output di: sha256sum /opt/zdesk/{server.js,public/index.html,public/app.js,public/app.css}"
fi
echo "[2/7] file attuali riconosciuti ($( [[ "$from" == *1* ]] && echo 'Radar v1' || echo 'master originale' ))"

curl -fsS -m 10 "$URL/api/health" >/dev/null 2>&1 && echo "      health prima: OK" || echo "      ATTENZIONE: health KO già prima dell'aggiornamento"

mkdir -p "$BK"
BACKUP="$BK/zdesk-pre-radar2-$TS.tar.gz"
tar --exclude="${APP#/}/node_modules" -czf "$BACKUP" -C / "${APP#/}"
echo "[3/7] backup: $BACKUP"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
tar -xzf "$TARBALL" -C "$STAGE"
for f in server.js public/app.js "${LIB_FILES[@]}"; do node --check "$STAGE/$f" || die "sintassi KO in $f"; done
T="$(mktemp -d)"; cp -a "$APP/lib" "$T/lib"; cp "$STAGE"/lib/*.js "$T/lib/"; mkdir -p "$T/public" "$T/scripts"
cp "$STAGE"/public/* "$T/public/"; cp "$STAGE/scripts/radar-staking-selftest.js" "$T/scripts/"
( cd "$T" && NODE_PATH="$APP/node_modules" node scripts/radar-staking-selftest.js >/dev/null ) || { rm -rf "$T"; die "selftest offline KO"; }
rm -rf "$T"
echo "[4/7] sintassi e selftest offline OK"

RB="$BK/rollback-radar2-$TS.sh"
{
  echo '#!/usr/bin/env bash'
  echo "# Rollback Radar v2 $TS: rimette i file di prima e riavvia zdesk."
  echo 'set -euo pipefail'
  echo "tar -xzf '$BACKUP' -C / ${APP#/}/server.js ${APP#/}/public/index.html ${APP#/}/public/app.js ${APP#/}/public/app.css"
  for f in "${LIB_FILES[@]}"; do
    if [ -f "$APP/$f" ]; then echo "tar -xzf '$BACKUP' -C / ${APP#/}/$f"; else echo "rm -f '$APP/$f'"; fi
  done
  echo "systemctl restart $SERVICE"
  echo "for i in \$(seq 1 30); do curl -fsS -m 3 $URL/api/health >/dev/null 2>&1 && { echo 'ROLLBACK OK'; exit 0; }; sleep 1; done"
  echo "echo 'ROLLBACK fatto ma health KO: journalctl -u $SERVICE -n 50'; exit 1"
} > "$RB"
chmod 700 "$RB"
echo "[5/7] rollback pronto: bash $RB"

for f in "${CODE_FILES[@]}"; do o="$(own "$APP/$f")"; install -m 644 "$STAGE/$f" "$APP/$f"; chown "$o" "$APP/$f"; done
o="$(own "$APP/lib/sources.js")"
for f in "${LIB_FILES[@]}"; do install -m 644 "$STAGE/$f" "$APP/$f"; chown "$o" "$APP/$f"; done
oa="$(own "$APP")"; mkdir -p "$APP/radar" "$APP/scripts"
for f in radar-x.schema.json radar-x.example.json; do install -m 644 "$STAGE/radar/$f" "$APP/radar/$f"; chown "$oa" "$APP/radar/$f"; done
install -m 644 "$STAGE/scripts/radar-staking-selftest.js" "$APP/scripts/radar-staking-selftest.js"; chown "$oa" "$APP/scripts/radar-staking-selftest.js"
od="$(own "$DESK")"
for f in radar-x.json radar-watch.json radar-news.json; do
  if [ ! -e "$DESK/$f" ]; then install -m 644 "$STAGE/radar/$f" "$DESK/$f"; chown "$od" "$DESK/$f"; echo "      creato $DESK/$f (vuoto, esempio)"; fi
done
echo "[6/7] file copiati"

systemctl restart "$SERVICE"
ok=0
for i in $(seq 1 30); do curl -fsS -m 3 "$URL/api/health" >/dev/null 2>&1 && { ok=1; break; }; sleep 1; done
fail() { echo "Controllo fallito: $1 — eseguo il rollback"; bash "$RB" || true; die "$1 (rollback eseguito)"; }
[ "$ok" = 1 ] || fail "health non risponde dopo il riavvio"
curl -fsS -m 10 "$URL/api/radar" | grep -q '"readOnly":true' || fail "/api/radar non risponde"
curl -fsS -m 15 "$URL/api/connect" | grep -q '"readOnly":true' || fail "/api/connect non risponde"
[ "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$URL/api/staking/abc")" = 400 ] || fail "/api/staking non valida gli indirizzi"
curl -fsS -m 10 -o /dev/null "$URL/api/copytrader" || fail "/api/copytrader non risponde"
curl -fsS -m 10 -o /dev/null "$URL/api/ninja" || fail "/api/ninja non risponde"
systemctl is-active --quiet "$SERVICE" || fail "servizio non attivo"
echo "[7/7] health, radar, connect, staking, copytrader e ninja OK"
echo "Facoltativo: per vedere gli stake nativi serve un RPC privato -> Environment=ZDESK_SOLANA_RPC=https://... nella unit zdesk."
echo "Backup:   $BACKUP"
echo "Rollback: bash $RB"
echo "ESITO OK"
