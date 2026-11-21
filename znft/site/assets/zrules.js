/*! zrules · host regole zNFT · ZDOS1.3. Esegue bytecode ZLB2 v2.5 prodotto da zlangc (emit, let, if…jump, etichette, storage.read).
 * storage.read "znft/a/b/nome" carica il valore fornito dall'host nella variabile `nome` (sola lettura, solo namespace znft/).
 * Lo stesso file gira nel server (Node) e nel browser (galleria): stesso bytecode, stesso esito. */
(function (root) {
  'use strict';
  function decode(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'ZLB2' || b[4] !== 2 || b[5] !== 5) throw new Error('bytecode non ZLB2 v2.5');
    const out = []; let i = 6; const td = new TextDecoder();
    while (i < b.length) {
      const op = b[i], len = b[i + 1] | (b[i + 2] << 8); const arg = td.decode(b.slice(i + 3, i + 3 + len)); i += 3 + len;
      out.push({ op, arg }); if (op === 0xff) break;
    }
    return out;
  }
  const NAME = /^[a-z_][a-z0-9_]*$/;
  function val(tok, vars) {
    if (/^-?\d+$/.test(tok)) return parseInt(tok, 10);
    if (!NAME.test(tok)) throw new Error('operando non valido: ' + tok);
    if (!(tok in vars)) throw new Error('variabile non letta: ' + tok);
    return vars[tok];
  }
  function run(bytes, storage, maxSteps) {
    const prog = decode(bytes); const vars = {}; const emits = []; const trace = [];
    const labels = {}; prog.forEach((ins, idx) => { if (ins.op === 0x04) labels[ins.arg] = idx; });
    let pc = 0, steps = 0; maxSteps = maxSteps || 3000;
    while (pc < prog.length && steps++ < maxSteps) {
      const { op, arg } = prog[pc];
      if (op === 0xff) break;
      if (op === 0x01) { emits.push(arg); trace.push('emit ' + arg); }
      else if (op === 0x06) {
        if (!arg.startsWith('znft/')) throw new Error('storage.read fuori namespace znft/: ' + arg);
        const name = arg.split('/').pop(); const v = storage[arg];
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('valore assente per ' + arg);
        vars[name] = Math.trunc(v); trace.push('storage.read ' + arg + ' = ' + vars[name]);
      } else if (op === 0x02) {
        const m = arg.match(/^([a-z_][a-z0-9_]*)\s*=\s*(\S+)(?:\s*([+-])\s*(\S+))?$/); if (!m) throw new Error('let non valido: ' + arg);
        let v = val(m[2], vars); if (m[3]) v = m[3] === '+' ? v + val(m[4], vars) : v - val(m[4], vars);
        vars[m[1]] = v; trace.push('let ' + m[1] + ' = ' + v);
      } else if (op === 0x03) {
        const m = arg.match(/^(\S+)\s*(==|!=|<=|>=|<|>)\s*(\S+)\s+jump\s+([A-Za-z_][\w]*)$/); if (!m) throw new Error('if non valido: ' + arg);
        const a = val(m[1], vars), c = val(m[3], vars); const ok = { '==': a === c, '!=': a !== c, '<': a < c, '>': a > c, '<=': a <= c, '>=': a >= c }[m[2]];
        if (ok) { if (!(m[4] in labels)) throw new Error('etichetta assente: ' + m[4]); pc = labels[m[4]]; trace.push('if ' + arg + ' → salto'); continue; }
      }
      pc++;
    }
    const last = emits[emits.length - 1] || '';
    return { ok: last === 'OK', esito: last, motivo: last.startsWith('BLOCCO:') ? last.slice(7) : '', emits, trace, steps };
  }
  async function sha256hex(bytes) {
    if (typeof crypto !== 'undefined' && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
    return require('crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  }
  const api = { decode, run, sha256hex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZRules = api;
})(typeof self !== 'undefined' ? self : this);
