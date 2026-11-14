# Visibilità dei repository

Il 14/11/2026 (ora di Roma) tutti i repository dell'account GitHub `high-cde` sono stati resi **privati**, su conferma del titolare. La visibilità non va cambiata in questa revisione.

## Effetti già in corso

- I siti GitHub Pages (`high-cde.github.io` e i project Pages) non sono più raggiungibili pubblicamente.
- Il download `raw.githubusercontent.com` da zSWAP non funziona più senza autenticazione. Il deploy di zdesk usa l'API GitHub con un token fine-grained in sola lettura (vedi `zdesk/deploy/README.md` e `docs/STATUS.md`).
- I siti ospitati sul VPS (tra cui https://x-zdos.it, https://swap.x-zdos.it, https://quest.x-zdos.it) non dipendono dalla visibilità dei repo e restano dove sono.
- L'operazione è reversibile lato GitHub, ma riaprire un repo pubblico ripubblicherebbe la cronaca e, se riattivate, anche le Pages.

## Branch di pulizia locali (non pubblicati sui repo originali)

Il codice aggiornato di ZDOS, Æsir, ZLang, zdesk e del prototipo ibrido è in questo monorepo. Sui repository originali restano, in locale e non su `main`, i branch di pulizia già preparati:

| Repo | Branch | Commit | Contenuto |
| --- | --- | --- | --- |
| ZDOS | `dsnx/sanitize` | `5bef94e` | README: sezione $DSN, avviso solo BIOS/installer; `.gitleaksignore` per 3 falsi positivi storici. |
| aesir | `dsnx/aesir-clean` | `1c3ae04` | Percorsi configurabili, gate $DSN multi-catena, VELVET opzionale, 26+9 test. |
| Zlang | `dsnx/sanitize` | `11f75ec` | Rimossi backup da 80 MB, sezione $DSN. |
| zdos-hybrid | `dsnx/sanitize` | `05c7d68` | MOCKS.md, badge «Zero Mock» tolto, workspace che compila, bind su 127.0.0.1. |
