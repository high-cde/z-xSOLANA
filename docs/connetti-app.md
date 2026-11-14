# Connetti app

Nel Radar di zdesk (sotto-tab «Connetti app») ci sono solo tre collegamenti, tutti in sola lettura.

| App | Cosa fa | Cosa NON fa |
| --- | --- | --- |
| X | Link al profilo pubblico (handle salvato solo nel browser, `localStorage`). | Non pubblica, non legge DM, nessun token. |
| GitHub | Link all'org `high-cde` e stato pubblico dell'org (API pubblica, cache 30 min). | Non scrive, nessun token. Se l'API pubblica risponde 403/limite, restano i link. |
| Phantom | Solo connessione: legge l'indirizzo pubblico per mostrare saldi e staking. Disconnessione con un clic. Su telefono: link «apri in Phantom». | Nessuna firma, nessuno swap, nessuna transazione, nessun fondo. |

Nessun collegamento a launchpad o piattaforme di trading (niente pump.fun, niente pulsanti di acquisto).
Endpoint: `GET /api/connect` (sola lettura).
