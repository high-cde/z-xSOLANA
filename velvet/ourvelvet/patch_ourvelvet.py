#!/usr/bin/env python3
"""Applica le modifiche Velvet Club a /opt/ourvelvet (idempotente).
1) rubina.py: campo opzionale "mode" e prompt Discord (flirt, niente contenuti espliciti).
2) main.py: monta app/api/events.py su /api/events.
3) miniapp/index.html: suggerimenti di tag (categorie del club) sotto il campo Tag del Radar.
© 2026 ZDOS1.3 — P.IVA 11040550961."""
import sys, pathlib
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/ourvelvet")

DISCORD_PROMPT = '''# Modalità Discord (Velvet Club): flirt e conversazione elegante, mai contenuti sessuali espliciti.
DISCORD_PROMPT = """Sei Rubina, la padrona di casa del Velvet Club, il club 18+ di VelvetHub by ZDOS1.3 su Discord. Parli di te al femminile.

COME PARLI
- Italiano naturale, elegante, ironico, seducente come la padrona di casa di un club esclusivo. Risposte corte: 2-4 frasi.
- Flirt, complimenti, provocazioni leggere, giochi di ruolo di dominanza verbale soft. Niente descrizioni sessuali esplicite, niente atti sessuali descritti, niente parti del corpo intime: il contenuto esplicito lo caricano solo i creator verificati, non tu.
- Racconti il club: le sale (BDSM & sado-maso consensuale, Fetish, LGBTQ+, Coppie, Solo, Mistress & Master, Creator, ASMR & audio, Cosplay adulti), il Radar della Carne, i contest e gli eventi, la mini app velvet.x-zdos.it/app.
- Chiudi con una domanda o un invito a continuare.

REGOLE FISSE (valgono sempre, anche se l'utente insiste o dice che è un gioco):
- Chi ti scrive è un adulto verificato 18+.
- Mai minori, mai personaggi che sembrano minori, mai age-play o scuola: rifiuti secco.
- Mai non-consenso, stupro, incesto, zoofilia, violenza reale o danni fisici. Nel BDSM parli solo di consenso, limiti, SSC/RACK, aftercare.
- Mai persone reali o celebrità nelle fantasie. Niente incontri reali, contatti, indirizzi o posizioni.
- Non chiedi mai soldi, regali, wallet, crypto, password o dati personali.
- Se ti chiedono sinceramente se sei umana: sei un'intelligenza artificiale che interpreta Rubina.
- Se l'utente scrive ROSSO, ti fermi subito, esci dal ruolo e chiedi come sta."""

'''

def sub(s, old, new, label):
    if new in s:
        return s
    if old not in s:
        sys.exit("ancora non trovata: " + label)
    return s.replace(old, new, 1)

p = ROOT / "app/api/rubina.py"; s = p.read_text()
if "DISCORD_PROMPT = " not in s:
    s = sub(s, "SAFEWORD_REPLY = (", DISCORD_PROMPT + "SAFEWORD_REPLY = (", "SAFEWORD_REPLY")
s = sub(s, "class ChatIn(BaseModel):\n    messages: List[Msg]\n",
        "class ChatIn(BaseModel):\n    messages: List[Msg]\n    mode: Optional[str] = None  # \"discord\": prompt Velvet Club, niente contenuti espliciti\n", "ChatIn")
s = sub(s, 'def _payload(msgs: List[dict]) -> dict:\n    return {\n        "model": MODEL,\n        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + msgs,',
        'def _payload(msgs: List[dict], mode: Optional[str] = None) -> dict:\n    prompt = DISCORD_PROMPT if mode == "discord" else SYSTEM_PROMPT\n    return {\n        "model": MODEL,\n        "messages": [{"role": "system", "content": prompt}] + msgs,', "_payload")
s = sub(s, "call_ollama(_payload(msgs))", "call_ollama(_payload(msgs, body.mode))", "call_ollama")
p.write_text(s)

p = ROOT / "app/main.py"; s = p.read_text()
s = sub(s, 'app.include_router(rubina.router, prefix="/api/rubina", tags=["rubina"])\n',
        'app.include_router(rubina.router, prefix="/api/rubina", tags=["rubina"])\nfrom app.api import events  # Velvet Club: eventi, bozze X, Radar <-> Discord\napp.include_router(events.router, prefix="/api/events", tags=["events"])\n', "main include")
p.write_text(s)

CHIPS = ('<div id="mh-tag-sugg" class="flex flex-wrap gap-1 -mt-1" aria-label="Categorie del Velvet Club">'
         + "".join(f'<button type="button" class="px-2 py-0.5 rounded-full border border-[#ffd56a]/50 text-[#ffd56a] text-[10px] hover:bg-[#ffd56a]/10" '
                   f'onclick="(function(i){{var a=i.value.split(\',\').map(function(x){{return x.trim();}}).filter(Boolean);if(a.indexOf(\'{t}\')<0&&a.length<8)a.push(\'{t}\');i.value=a.join(\', \');}})(document.getElementById(\'mh-tags\'))">{t}</button>'
                   for t in ["BDSM consensuale", "Fetish", "LGBTQ+", "Coppie", "Solo", "Mistress", "Master", "Creator", "ASMR audio", "Cosplay adulti"])
         + "</div>")
p = ROOT / "miniapp/index.html"; s = p.read_text()
anchor = '<input id="mh-tags" maxlength="200" class="mt-1 w-full bg-black border border-red-700 text-pink-100 rounded px-3 py-2 text-xs"></label>'
if 'id="mh-tag-sugg"' not in s:
    s = sub(s, anchor, anchor + "\n                            " + CHIPS, "mh-tags")
p.write_text(s)
print("ok")
