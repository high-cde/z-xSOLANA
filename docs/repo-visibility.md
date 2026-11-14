# Visibilità dei repository esistenti

Nessun repository esistente è stato reso privato né riscritto. Le pulizie sono su branch locali non pubblicati; questa tabella serve a decidere.

## Cosa si romperebbe rendendoli privati

| Repo | Oggi | Cosa si rompe se privato | Proposta |
| --- | --- | --- | --- |
| zSWAP | pubblico | Il deploy sul VPS scarica i file da `raw.githubusercontent.com/high-cde/zSWAP/...` senza token: si fermerebbe. | Resta pubblico. In futuro: deploy con token in sola lettura o release firmate, poi privato. |
| VelvetHub | pubblico, GitHub Pages | Il sito `high-cde.github.io/VelvetHub/` sparisce (Pages su repo privati richiede un piano a pagamento). | Resta pubblico, oppure sito spostato su hosting proprio. |
| Zdos-K.I.R.A | pubblico, GitHub Pages | Il sito `high-cde.github.io/Zdos-K.I.R.A/` sparisce (stesso motivo). | Resta pubblico, oppure hosting proprio. |
| high-cde.github.io | pubblico, GitHub Pages | Il sito principale `high-cde.github.io` sparisce. | Resta pubblico. |
| ZDOS | pubblico, GitHub Pages | Sparisce `high-cde.github.io/ZDOS/`; i link dal sito x-zdos.it e dai documenti cadono. | Privato possibile dopo aver spostato la pagina; il codice è già in z-xSOLANA. |
| Zlang | pubblico, GitHub Pages | Sparisce `high-cde.github.io/Zlang/`; i documenti e `microcosm/catalog.json` di ZDOS lo clonano in pubblico. | Privato possibile dopo aver aggiornato catalogo e documenti. |
| aesir | pubblico | Nessun uso pubblico trovato (niente Pages, niente raw). | Può diventare privato: il codice aggiornato è in z-xSOLANA. |
| zdos-hybrid | pubblico | Lo script `zdos-evolution-deploy.sh` lo clona in pubblico; altrimenti nulla. Storia pesante (~184 MB, vecchio virtualenv). | Privato o archiviato; il codice utile è in `labs/hybrid-prototype`. |

## Branch di pulizia locali (non pubblicati)

| Repo | Branch | Commit | Contenuto |
| --- | --- | --- | --- |
| ZDOS | `dsnx/sanitize` | `5bef94e` | README: sezione $DSN, avviso solo BIOS/installer; `.gitleaksignore` per 3 falsi positivi storici. |
| aesir | `dsnx/aesir-clean` | `1c3ae04` | Percorsi configurabili, gate $DSN multi-catena, VELVET opzionale, 26+9 test. |
| Zlang | `dsnx/sanitize` | `11f75ec` | Rimossi backup da 80 MB, sezione $DSN. |
| zdos-hybrid | `dsnx/sanitize` | `05c7d68` | MOCKS.md, badge «Zero Mock» tolto, workspace che compila, bind su 127.0.0.1. |
