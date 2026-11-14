'use strict';

/**
 * ZDOS Radar · Staking (sola lettura, NON custodial).
 *
 * Dato un indirizzo pubblico Solana (es. quello connesso con Phantom) legge da RPC:
 *  - saldo SOL;
 *  - conti di stake nativi (programma Stake, filtro staker/withdrawer): validator,
 *    stato di attivazione calcolato dall'epoca, importo;
 *  - ricompense reali dell'ultima epoca chiusa (getInflationReward), solo se pochi conti;
 *  - saldi dei liquid staking token (JitoSOL, mSOL, bSOL, INF) letti dai conti associati
 *    con una sola getMultipleAccounts (non indicizzata).
 * Nessuna chiave, nessuna firma, nessun deposito, nessuna transazione. Solo GET.
 * Cache 5 minuti per indirizzo (ricompense 30 minuti) e una sola richiesta in volo per indirizzo.
 */
const { httpJson } = require('./sources');
const { cache } = require('./cache');
const { b58decode, associatedTokenAddress, TOKEN_PROGRAM } = require('./solana-ata');

const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
const U64_MAX = '18446744073709551615';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TTL_MS = 5 * 60_000;
const REWARD_TTL_MS = 30 * 60_000;
const MAX_REWARD_ACCOUNTS = 10;
const RPCS = [
  process.env.ZDESK_SOLANA_RPC,
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean);

// Mint verificati sulle documentazioni ufficiali (14/11/2026) e on-chain:
// programma SPL Token classico, 9 decimali.
const LST = [
  { symbol: 'JitoSOL', name: 'Jito Staked SOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', source: 'https://www.jito.network/docs/jitosol/faqs/technical-faqs/' },
  { symbol: 'mSOL', name: 'Marinade Staked SOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', source: 'https://docs.marinade.finance/developers/contract-addresses/' },
  { symbol: 'bSOL', name: 'BlazeStake Staked SOL', mint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', source: 'https://stake-docs.solblaze.org/developers/addresses' },
  { symbol: 'INF', name: 'Sanctum Infinity', mint: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm', source: 'https://sanctum.so/blog/sanctum-infinity-launch-solana-lst-liquidity-pool' },
];

const inflight = new Map();

function isAddress(a) {
  if (typeof a !== 'string' || !B58.test(a)) return false;
  try { return b58decode(a).length === 32; } catch { return false; }
}

async function rpc(method, params) {
  let last = null;
  for (const url of RPCS) {
    try {
      const data = await httpJson(url, {
        method: 'POST',
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (data && data.error) { last = new Error(data.error.message || 'errore RPC'); continue; }
      return data.result;
    } catch (e) { last = e; }
  }
  throw last || new Error('RPC non raggiungibile');
}

function stakeState(d, epoch) {
  if (!d) return 'non delegato';
  const act = BigInt(d.activationEpoch);
  const deact = String(d.deactivationEpoch);
  const ep = BigInt(epoch);
  if (deact !== U64_MAX) return BigInt(deact) <= ep ? 'inattivo' : 'in disattivazione';
  return act >= ep ? 'in attivazione' : 'attivo';
}

function parseStake(acc, epoch) {
  const parsed = acc.account && acc.account.data && acc.account.data.parsed;
  const info = (parsed && parsed.info) || {};
  const d = info.stake && info.stake.delegation;
  return {
    address: acc.pubkey,
    lamports: Number(acc.account.lamports || 0),
    delegatedLamports: d ? Number(d.stake) : 0,
    validator: d ? d.voter : null,
    state: stakeState(d, epoch),
    activationEpoch: d ? Number(d.activationEpoch) : null,
    deactivationEpoch: d && String(d.deactivationEpoch) !== U64_MAX ? Number(d.deactivationEpoch) : null,
    staker: info.meta && info.meta.authorized && info.meta.authorized.staker,
    withdrawer: info.meta && info.meta.authorized && info.meta.authorized.withdrawer,
  };
}

async function nativeStakes(address, epoch) {
  const q = (offset) => rpc('getProgramAccounts', [STAKE_PROGRAM, {
    encoding: 'jsonParsed',
    filters: [{ memcmp: { offset, bytes: address } }],
  }]);
  const [a, b] = await Promise.allSettled([q(12), q(44)]); // 12 = staker, 44 = withdrawer
  if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
  const seen = new Map();
  for (const r of [a, b]) if (r.status === 'fulfilled') for (const acc of r.value || []) seen.set(acc.pubkey, parseStake(acc, epoch));
  return [...seen.values()];
}

async function rewards(addresses, epoch) {
  if (!addresses.length || addresses.length > MAX_REWARD_ACCOUNTS || epoch < 1) return null;
  const key = 'stake-rw:' + (epoch - 1) + ':' + addresses.join(',');
  const hit = cache.fresh(key);
  if (hit) return hit;
  const res = await rpc('getInflationReward', [addresses, { epoch: epoch - 1 }]);
  const out = { epoch: epoch - 1, items: addresses.map((a, i) => ({ address: a, lamports: res && res[i] ? Number(res[i].amount) : null, commission: res && res[i] ? res[i].commission : null })) };
  return cache.set(key, out, REWARD_TTL_MS);
}

async function lstBalances(address) {
  const atas = LST.map((t) => associatedTokenAddress(address, t.mint, TOKEN_PROGRAM));
  const res = await rpc('getMultipleAccounts', [atas, { encoding: 'jsonParsed' }]);
  const vals = (res && res.value) || [];
  return LST.map((t, i) => {
    const v = vals[i];
    const info = v && v.data && v.data.parsed && v.data.parsed.info;
    const ok = info && info.mint === t.mint && info.owner === address;
    return { ...t, account: atas[i], amount: ok ? info.tokenAmount.uiAmountString : '0', raw: ok ? info.tokenAmount.amount : '0' };
  });
}

async function build(address) {
  const [epochInfo, balance] = await Promise.all([rpc('getEpochInfo', []), rpc('getBalance', [address])]);
  const epoch = epochInfo.epoch;
  const out = {
    address, epoch, readOnly: true, custodial: false,
    solLamports: Number((balance && balance.value) || 0),
    stakes: [], stakeError: null, rewards: null, rewardsError: null, lst: [], lstError: null,
    updatedAt: new Date().toISOString(),
  };
  const [st, lst] = await Promise.allSettled([nativeStakes(address, epoch), lstBalances(address)]);
  if (st.status === 'fulfilled') out.stakes = st.value;
  else out.stakeError = 'Gli RPC pubblici non permettono la ricerca dei conti di stake (getProgramAccounts). Imposta ZDESK_SOLANA_RPC con un RPC privato.';
  if (lst.status === 'fulfilled') out.lst = lst.value; else out.lstError = String((lst.reason && lst.reason.message) || lst.reason);
  if (out.stakes.length) {
    try { out.rewards = await rewards(out.stakes.map((s) => s.address), epoch); }
    catch (e) { out.rewardsError = String(e.message || e); }
  }
  return out;
}

async function getStaking(address) {
  if (!isAddress(address)) { const e = new Error('indirizzo Solana non valido'); e.status = 400; throw e; }
  const key = 'staking:' + address;
  const hit = cache.fresh(key);
  if (hit) return hit;
  if (inflight.has(address)) return inflight.get(address);
  const p = build(address)
    .then((v) => cache.set(key, v, TTL_MS))
    .finally(() => inflight.delete(address));
  inflight.set(address, p);
  return p;
}

module.exports = { getStaking, isAddress, stakeState, parseStake, LST, STAKE_PROGRAM };
