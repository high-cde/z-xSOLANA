# Rubina e Zara · deploy sul VPS (21/11/2026)

- `app/api/personas.py` → `/opt/ourvelvet/app/api/` (router `/api/personas`, header `x-agi-key` da `/etc/ourvelvet/agi.key`, 640 root:agikey)
- `app/api/agi_tg.py` → comandi Telegram (/rubina /zara /eventi /condividi /bozza /ricordami /dimentica /velvet18 /invita, presentazione quando il bot viene aggiunto a un gruppo)
- `data/kb/*.md` → `/opt/ourvelvet/data/kb/` (ricaricata da sola quando cambia)
- `app/main.py`: dopo il router events
  `from app.api import personas` + `app.include_router(personas.router, prefix="/api/personas")` + `from app.api import agi_tg`
- `app/api/bot.py` `ensure_webhook`: imposta il webhook anche quando l'URL attuale è vuoto (prima restava vuoto e il bot non riceveva niente).
- Modello: `llama3.2:3b` su Ollama, keep_alive 2h, warmup ogni 10 minuti, nessun `num_ctx` (stesso default di zdos-agency, evita ricariche).
- zdiscord: drop-in `/etc/systemd/system/zdiscord.service.d/10-agi-restart.conf` (SupplementaryGroups=agikey, RestartSec=30).
- Zara Lsd: `/opt/zara-bot` (zara.js, agi.js, node_modules di zdiscord), unità `zara-bot.service`, utente `zara`, token in `/etc/zara/bot.env` (600 root).
- Rollback: `bash /var/backups/agi/<ts>/rollback.sh`.
