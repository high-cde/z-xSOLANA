# Z-Sound — studio musicale di OurVelvet (© ZDOS1.3, licenza proprietaria)

Studio DJ nel browser (Web Audio) su https://ourvelvet.online/creator/z-sound/ , collegato al profilo creator di OurVelvet Social.

- `web/` front-end (2 deck, mixer, FX, campionatore sintetico, registrazione WAV/WebM, MIDI/tastiera, pubblicazione).
- `server/server.mjs` backend zdos-social con estensione audio (upload validato per magic-byte, max 25 MB / 30 min, quota 200 MB, moderazione staff, Range) — base: la versione live (include Pool Party, `pool.mjs` in `ourvelvet-creator/pool-party/server/`).
- `server/zsound-ai.mjs` adattatore "Genera con AI": SPENTO (`enabled:false`) finché ZDOS1.3 non approva un fornitore e inserisce la chiave. Fornitori previsti: stability, elevenlabs, selfhost. Nessuna chiave nel repo.
- `deploy/zdos-zsound.conf` snippet nginx, `deploy/rollback.sh` rollback.
- Test: `server/test-zsound.mjs` (e2e API), `server/test-zsound-ai.mjs` (adattatore con fornitore simulato).

Nessun campione di terzi, nessuna traccia demo. Regole 18+ di OurVelvet: solo adulti, solo consenso, safeword ROSSO.
