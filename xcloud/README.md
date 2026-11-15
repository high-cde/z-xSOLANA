# xCLOUD by ZDOS — Gestionale (MVP demo)

Demo statica del gestionale multi-settore, online su https://x-zdos.it/xcloud/.

**Stato:** demo. Tutti i dati sono di esempio e restano nel browser (localStorage, foto in IndexedDB). Nessun backend, nessun dato personale sul server, nessun invio a SDI, nessun pagamento.

## Cosa funziona
- Aziende multi-tenant con controllo formale della partita IVA (cifra di controllo).
- Anagrafica dipendenti e ruoli simulati (RBAC: Titolare, Amministrazione, Capo cantiere, Dipendente).
- Timbrature entrata/uscita, ore del giorno, export CSV per il consulente del lavoro.
  Geolocalizzazione spenta di default; se attivata (dopo avviso art. 4 Statuto dei Lavoratori / GDPR) legge la posizione solo alla timbratura e salva solo l'esito "in sede sì/no".
- Annunci di lavoro con filtro per km, settore e contratto. Distanza calcolata nel browser (haversine); la posizione GPS è chiesta solo con consenso e non viene salvata. Controllo dei testi contro requisiti discriminatori (art. 10 D.Lgs. 276/2003).
- Galleria cantiere: foto ricodificate nel browser (EXIF/GPS rimossi).
- Bozze fattura con calcolo IVA; export XML FatturaPA FPR12 (valido contro lo schema XSD v1.2.2 dell'Agenzia delle Entrate) e PDF di cortesia, entrambi marcati "DOCUMENTO DI PROVA — NON INVIATO A SDI".
- Bacheca interna per canali, funzionamento offline (service worker), registro attività locale.

## Cosa non c'è (dichiarato nell'interfaccia)
Invio SDI e conservazione, paghe/LUL, pagamenti PayPal/Stripe/X Money/crypto, cifratura zcomm, area creator adult.

## Deploy
`deploy/applica-xcloud.sh`: release in `/var/www/xcloud/releases/<ts>-mvp`, location nginx `/xcloud/` (con `nginx -t` e backup), link nel portale, rollback in `/var/backups/xcloud/<ts>/rollback.sh`.

ZDOS1.3 · P.IVA 11040550961 · licenza proprietaria ZSEL.
