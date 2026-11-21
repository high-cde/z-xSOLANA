#!/bin/bash
# Kill switch del fondo merito: ferma subito ogni invio (il prossimo lunedì non parte niente).
# Crea /etc/zdos-fondo-merito/STOP e mette emissionsLive=false nel config. I punti continuano a essere calcolati.
# Per riattivare: togliere STOP e rimettere emissionsLive=true SOLO con un ok esplicito di doc.
set -euo pipefail
CFG=/etc/zdos-fondo-merito/config.json
cp -a "$CFG" "$CFG.bak.$(date +%Y%m%d-%H%M%S)"
touch /etc/zdos-fondo-merito/STOP
python3 - "$CFG" <<'PY'
import json,sys
p=sys.argv[1];c=json.load(open(p));c["emissionsLive"]=False;c["status"]="stopped"
json.dump(c,open(p,"w"),ensure_ascii=False,indent=2)
PY
echo "Fondo merito FERMO: emissionsLive=false e file STOP presente."
