# Sfera predittiva — formula (ZDESK)

La colonna **Sfera** è un punteggio in `[0, 1]` calcolato solo da dati pubblici
(DexScreener, GeckoTerminal, RugCheck, RPC Solana). **Non è un segnale di
ingresso automatico** del desk. Restano valide le regole SAFE-COMPOUND
(entry meme solo con score desk ≥ 0.85, tetto sleeve 5%, ecc.).

Non usa l'API GMGN (bloccata da Cloudflare da questo ambiente). Il fattore
"smart money" non è disponibile e i pesi vengono rinormalizzati senza di esso.

## Pesi originali (somma = 1.00)

| Fattore | Chiave | Peso |
|---|---|---|
| Liquidità USD | `liq` | 0.25 |
| Crescita del volume | `vol` | 0.20 |
| Rapporto buy / sell | `bs` | 0.20 |
| Concentrazione holder | `hold` | 0.20 |
| Authority mint/freeze revocate | `auth` | 0.15 |

Se un fattore manca, i pesi dei fattori **disponibili** vengono rinormalizzati
così che la loro somma sia 1. Il punteggio è marcato come *dati parziali* (`*`).

```
score_raw = Σ (peso_i / Σ pesi_disponibili) * s_i
```

## Fattori (ognuno in 0–1)

### 1. Liquidità (`s_liq`)

Scala logaritmica sul valore di liquidità della pair principale (USD):

- `liq < $1.000` → 0
- `liq ≥ $200.000` → 1
- altrimenti `s = log10(liq / 1000) / log10(200)`

### 2. Crescita volume (`s_vol`)

```
pace = vol_1h / max(vol_6h / 6, ε)
```

Se `vol_6h` manca, si usa `vol_1h / max(vol_24h / 24, ε)`.

- `pace ≤ 0.25` (volume in calo) → 0
- `pace = 1` (stabile) → 0.50
- `pace ≥ 3` (accelerazione) → 1
- interpolazione lineare a tratti tra questi punti

### 3. Buy / sell (`s_bs`)

```
share = buys / (buys + sells)
```

Si usano i conteggi a 1h, con fallback a 6h o 24h.

- 30% buy → 0
- 50% buy → 0.50
- ≥ 80% buy → 1
- `s = clamp((share - 0.30) / 0.50, 0, 1)`

### 4. Concentrazione holder (`s_hold`)

Si preferisce il **top 10% esclusi pool / bonding curve** (dai report RugCheck
e dagli indirizzi di mercato). Altrimenti il top 10 grezzo.

- top10 ≤ 15% → 1.00
- top10 ≥ 55% → 0.00
- lineare in mezzo: `1 - (top10 - 15) / 40`

Penalità sull'holder più grande (ex-pool): se top1 > 15%, si moltiplica per

```
1 - min((top1 - 15) / 35, 0.50)
```

### 5. Authority (`s_auth`)

Da RugCheck e/o `getAccountInfo` on-chain:

- mint **e** freeze revocate → 1.00
- una sola revocata → 0.40
- entrambe ancora attive → 0.00
- dato mancante → fattore omesso (rinorm)

## Modificatori dopo la media pesata

1. RugCheck `danger` oppure `rugged=true` → **cap a 0.40**
2. RugCheck `warn` (senza danger) → moltiplica × **0.90**
3. Liquidità della pair `< $5.000` → **cap a 0.45** (illiquido)
4. Arrotondamento a 3 decimali

## Cosa non è

- Non è un oracle di prezzo e non prevede il futuro con certezza.
- Non sostituisce lo score Analyst del desk (`go.md`).
- Non esegue trade, non tocca wallet, non aggirà georestrizioni.

Implementazione: `lib/score.js`.
