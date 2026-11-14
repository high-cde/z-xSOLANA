'use strict';

/**
 * Solana helpers senza dipendenze: base58 e indirizzo del conto token associato (ATA).
 * Serve a leggere un saldo con getAccountInfo/getMultipleAccounts (chiamate non
 * indicizzate, accettate anche dagli RPC pubblici). Nessuna chiave, nessuna firma.
 */
const crypto = require('crypto');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

function b58decode(s) {
  let n = 0n;
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('base58 non valido');
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  let pad = 0;
  while (pad < s.length && s[pad] === '1') pad++;
  return Buffer.from([...new Array(pad).fill(0), ...bytes]);
}

function b58encode(buf) {
  let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0'));
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  let pad = 0;
  while (pad < buf.length && buf[pad] === 0) pad++;
  return '1'.repeat(pad) + out;
}

const P = 2n ** 255n - 19n;
function modpow(b, e, m) {
  let r = 1n; b %= m;
  while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
  return r;
}
const D = ((-121665n * modpow(121666n, P - 2n, P)) % P + P) % P;

function onCurve(bytes) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
  y &= (1n << 255n) - 1n;
  if (y >= P) return false;
  const y2 = (y * y) % P;
  const u = (y2 - 1n + P) % P;
  const v = (D * y2 + 1n) % P;
  const x2 = (u * modpow(v, P - 2n, P)) % P;
  if (x2 === 0n) return true;
  return modpow(x2, (P - 1n) / 2n, P) === 1n;
}

function findProgramAddress(seeds, programId) {
  const pid = b58decode(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const h = crypto.createHash('sha256')
      .update(Buffer.concat([...seeds, Buffer.from([bump]), pid, Buffer.from('ProgramDerivedAddress')]))
      .digest();
    if (!onCurve(h)) return b58encode(h);
  }
  throw new Error('nessun PDA');
}

function associatedTokenAddress(owner, mint, tokenProgram = TOKEN_PROGRAM) {
  return findProgramAddress([b58decode(owner), b58decode(tokenProgram), b58decode(mint)], ATA_PROGRAM);
}

module.exports = { b58decode, b58encode, associatedTokenAddress, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, ATA_PROGRAM };
