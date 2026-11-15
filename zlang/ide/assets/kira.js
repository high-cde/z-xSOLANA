/* K.I.R.A. nell'IDE
 * 1) tokenChecks: port parziale di kiraChecks() da z-xSOLANA/zdesk/app/lib/radar.js.
 *    Qui girano solo i controlli che si possono fare con l'RPC Solana (mint e freeze authority, supply, programma).
 *    Top holder, LP, insider, RugCheck: n/d (in zdesk usano RugCheck e DexScreener lato server).
 * 2) lint: regole statiche dell'IDE sui due toolchain ZLang reali. Non è un audit di sicurezza. */
(function (root) {
  'use strict';
  const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  const TOKEN_V1 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  function check(id, label, status, detail) { return { id, label, status, detail }; }

  async function tokenChecks(cluster, mint) {
    const info = await root.ZComm.rpc(cluster, 'getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    const checks = [];
    if (!info || !info.value) return { verdict: 'N/D', checks: [check('acct', 'Account', 'fail', 'mint non trovato su ' + cluster)], fails: 1, warns: 0 };
    const v = info.value;
    const prog = v.owner === TOKEN_2022 ? 'Token-2022' : v.owner === TOKEN_V1 ? 'SPL Token' : 'altro (' + v.owner + ')';
    const parsed = v.data && v.data.parsed;
    if (!parsed || parsed.type !== 'mint') return { verdict: 'N/D', checks: [check('acct', 'Account', 'fail', 'non è un mint SPL (' + prog + ')')], fails: 1, warns: 0 };
    const p = parsed.info;
    checks.push(check('prog', 'Programma token', 'ok', prog));
    checks.push(check('mint', 'Mint authority', p.mintAuthority == null ? 'ok' : 'fail', p.mintAuthority == null ? 'revocata' : 'ATTIVA: si possono stampare token'));
    checks.push(check('freeze', 'Freeze authority', p.freezeAuthority == null ? 'ok' : 'fail', p.freezeAuthority == null ? 'revocata' : 'ATTIVA: i wallet possono essere congelati'));
    const dec = p.decimals; const sup = Number(p.supply) / Math.pow(10, dec);
    checks.push(check('supply', 'Supply e decimali', 'ok', sup.toLocaleString('it-IT') + ' · ' + dec + ' decimali'));
    const ext = (p.extensions || []).map((x) => x.extension);
    if (ext.length) {
      const risky = ext.filter((x) => /permanentDelegate|transferHook|transferFeeConfig|nonTransferable|pausable/i.test(x));
      checks.push(check('ext', 'Estensioni Token-2022', risky.length ? 'warn' : 'ok', ext.join(', ')));
    }
    ['top10', 'lp', 'insider', 'rug'].forEach((id) => checks.push(check(id, { top10: 'Top 10 holder', lp: 'Liquidità (LP)', insider: 'Insider / bundle', rug: 'RugCheck' }[id], 'nd', 'nel Radar di zdesk (RugCheck/DexScreener), non nell\'IDE')));
    checks.push(check('dev', 'Vendite del dev', 'nd', 'non calcolato (fase 2, anche in zdesk)'));
    const fails = checks.filter((c) => c.status === 'fail').length;
    const warns = checks.filter((c) => c.status === 'warn').length;
    return { verdict: fails ? 'EVITARE' : warns >= 2 ? 'OSSERVARE' : 'NESSUN RED FLAG (controlli parziali)', fails, warns, checks };
  }

  function lint(src) {
    const out = [];
    const lines = src.split('\n');
    const labels = new Set(); const jumps = [];
    let lets = new Set();
    lines.forEach((raw, i) => {
      const n = i + 1; const l = raw.trim();
      if (!l || l.startsWith('#')) return;
      if (l.startsWith('//')) out.push({ line: n, level: 'error', msg: 'I commenti // non esistono in zlangc: usa #.' });
      else if (l.startsWith('emit ')) { /* ok */ }
      else if (l.startsWith('let ')) {
        const m = l.slice(4).split('=');
        if (m.length !== 2) out.push({ line: n, level: 'error', msg: 'let richiede "nome = valore".' });
        else {
          const name = m[0].trim(); const rhs = m[1].trim(); lets.add(name);
          if (/[+*/]/.test(rhs)) out.push({ line: n, level: 'warn', msg: 'La VM Rust esegue solo valori interi e sottrazione a - b: + * / vengono letti come 0.' });
          else if (!/^\d+$/.test(rhs) && !/^\w+\s*-\s*\w+$/.test(rhs)) out.push({ line: n, level: 'warn', msg: 'La VM Rust accetta un intero o "a - b": questo valore diventa 0.' });
        }
      }
      else if (l.startsWith('if ')) { const m = l.match(/jump\s+(\w+)/); if (m) jumps.push({ line: n, label: m[1] }); out.push({ line: n, level: 'info', msg: 'if: compilato da zlangc (opcode 0x03), ignorato dalla VM Rust.' }); }
      else if (l.endsWith(':')) labels.add(l.slice(0, -1));
      else if (l.startsWith('wait')) out.push({ line: n, level: 'info', msg: 'wait: compilato da zlangc (0x05), ignorato dalla VM Rust.' });
      else if (l.startsWith('storage.read ')) {
        const p = l.slice(13).trim().replace(/^["']+|["']+$/g, '');
        if (!p || p.startsWith('/') || p.split('/').includes('..')) out.push({ line: n, level: 'error', msg: 'storage.read fuori namespace: niente percorsi assoluti né "..".' });
      }
      else out.push({ line: n, level: 'error', msg: 'Sintassi non supportata da zlangc v2.5: la compilazione si ferma qui.' });
    });
    jumps.forEach((j) => { if (!labels.has(j.label)) out.push({ line: j.line, level: 'warn', msg: 'Etichetta "' + j.label + '" non definita.' }); });
    if (lets.size > 14) out.push({ line: 1, level: 'warn', msg: 'Più di 14 variabili: la VM Rust riusa i registri R1–R14 e i valori si sovrascrivono.' });
    return out.sort((a, b) => a.line - b.line);
  }
  root.Kira = { tokenChecks, lint };
})(window);
