# Staking (non custodial, sola lettura)

zdesk legge soltanto dati pubblici della blockchain Solana. Nessuna chiave, nessuna firma, nessun deposito in wallet dell'app.
Endpoint: `GET /api/staking/:address` (cache 5 min, richieste uguali raggruppate).

## Cosa mostra
- **Stake account nativi** dell'indirizzo (come staker o withdrawer): validator, stato (attivo, in attivazione, in disattivazione, inattivo, non delegato), importo.
- **Ricompense**: inflation reward dell'ultima epoca, solo se gli stake account sono ≤ 10 (cache 30 min).
- **Liquid staking token** (LST): saldi JitoSOL, mSOL, bSOL, INF con una sola chiamata `getMultipleAccounts` sui conti associati.

Gli stake nativi richiedono un RPC che consenta `getProgramAccounts` (gli RPC pubblici gratuiti spesso lo rifiutano):
impostare `ZDESK_SOLANA_RPC=https://…` nella unit del servizio. Senza, la sezione mostra un link a Solscan.

## Mint LST verificati (fonti ufficiali, 14/11/2026)

| Token | Mint | Programma | Decimali | Fonte |
| --- | --- | --- | --- | --- |
| JitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | SPL Token | 9 | jito.network, FAQ tecniche |
| mSOL | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So` | SPL Token | 9 | docs.marinade.finance, contract addresses |
| bSOL | `bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1` | SPL Token | 9 | stake-docs.solblaze.org, addresses |
| INF | `5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm` | SPL Token | 9 | sanctum.so, blog di lancio Infinity |

## $DSN e VELVET
**Staking a punti, nessun rendimento.** Solo progetto: nessun contratto, nessun deposito, nessuna promessa.

## Guida: mettere SOL in staking con Phantom
1. **Apri Phantom.** Nella schermata principale tocca Solana (SOL).
2. **Avvia lo staking.** Tocca «Stake» (o «Inizia a guadagnare SOL») e scegli lo staking nativo.
3. **Scegli un validator.** Preferisci commissione bassa, buona uptime e un validator non tra i più grandi: aiuta la decentralizzazione.
4. **Inserisci l'importo.** Lascia almeno 0,01–0,05 SOL liberi per le commissioni di rete.
5. **Conferma in Phantom.** La firma avviene solo dentro Phantom. Lo stake si attiva all'inizio dell'epoca successiva (circa 2 giorni).
6. **Controlla in zdesk.** Radar → Staking mostra conto di stake, validator, stato e ricompense, in sola lettura.
7. **Per ritirare.** In Phantom: «Unstake». Dopo la fine dell'epoca i SOL tornano prelevabili.

Lo staking ha rischi (validator, slashing futuro, prezzo di SOL). Questa guida non è un consiglio finanziario.
