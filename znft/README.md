# zNFT · Galleria certificati d'opera 18+ (DEVNET di test)

Online: https://velvet.x-zdos.it/znft/ — solo Solana **devnet**, nessun valore reale.

## Cosa contiene
- `site/`: galleria (SPA statica): collezioni, pagina opera, profilo artista, certificato, crea, consenso modelli, upgrade, Velvet Pay, regole, "i miei". `site/admin/`: coda di moderazione staff.
- `api/server.mjs`: API Node 22 (`node:sqlite`, porta 4190): login con firma Phantom (SIWS), dichiarazioni artista e consensi modelli firmati, mint Metaplex Core, listing e acquisti in VPAY verificati on-chain, segnalazioni, faucet di test. `api/seed.mjs`: 6 opere astratte "opera di esempio".
- `chain/`: script devnet: `create-vpay.mjs` (Velvet Pay Token-2022), `make-collection.mjs`, `lib.mjs`, test di flusso. Le chiavi (`*keypair*.json`) NON sono nel repo.
- `zlang/`: regole della galleria in Zlang (`znft_regole`, `znft_vendita`, `znft_acquisto`), bytecode ZLB2 e `zrules.js` (interprete usato da server e browser).
- `polygon/`: `VelvetPayTest.sol` (ERC-20 18 decimali, solo chainid 80002 Amoy) e script di deploy. **Non pubblicato**: serve POL di test Amoy.
- `deploy/`: unit systemd e snippet nginx d'esempio (la chiave admin è un segnaposto).
- `tools/`: server locale e test e2e Playwright (desktop + mobile).

## Indirizzi devnet
- Velvet Pay (VPAY, TEST): `ESFG2VFX6ptALeruvT4mN7LN4DewoCrAXW9YfkaZLAKk` — https://explorer.solana.com/address/ESFG2VFX6ptALeruvT4mN7LN4DewoCrAXW9YfkaZLAKk?cluster=devnet
- Collezione Core "zNFT Certificati TEST": `Hz5EouBLmwmD19A5c7ixkGdEykUMMkCGWHeFXdq7er9u`
- Primo zNFT di prova: `7e7dGEmkRqmWR443qrtGdL496sqnK32GtM49W1eA1ndH`

## Limiti dichiarati
- Età 18+ autodichiarata e firmata: nessun KYC integrato.
- I file originali restano sul dispositivo dell'artista: on-chain va solo l'hash SHA-256.
- Le regole Zlang girano sul server (fuori catena) e sono verificabili nel browser con lo stesso bytecode.
- Nessun bridge Solana ↔ Polygon: solo lavoro futuro.
- Il nome "Velvet Pay" è già usato da altre aziende: verifica del marchio necessaria prima di qualunque uso fuori dal test.
