/* zlangc v2.5 — port JavaScript fedele di z-xSOLANA/zlang/tools/zlangc.py.
 * Produce lo stesso bytecode ZLB2 (magic "ZLB2", versione 2.5) e lo stesso header C.
 * Verificato byte per byte contro lo script Python (vedi tests/zlangc-parity.mjs). */
(function (root) {
  'use strict';
  const enc = new TextEncoder();
  // Python str.strip('"\'') : toglie virgolette singole/doppie ai due estremi
  function stripQuotes(s) { return s.replace(/^["']+/, '').replace(/["']+$/, ''); }
  function pyStrip(s) { return s.replace(/^\s+|\s+$/g, ''); }
  function le16(n) { return [n & 0xff, (n >> 8) & 0xff]; }

  function compile(source) {
    const bytes = [0x5a, 0x4c, 0x42, 0x32, 0x02, 0x05]; // 'ZLB2' + v2.5
    let count = 0;
    const lines = source.split(/(?<=\n)/);
    const map = []; // offset -> riga sorgente
    for (let i = 0; i < lines.length; i++) {
      const line = pyStrip(lines[i]);
      const lineNo = i + 1;
      if (!line || line.startsWith('#')) continue;
      const push = (op, payload) => {
        if (payload.length > 0xffff) return { ok: false, line: lineNo, error: 'payload oltre 65535 byte' };
        map.push({ offset: bytes.length, op, line: lineNo });
        bytes.push(op, ...le16(payload.length), ...payload);
        count++; return null;
      };
      let err = null;
      if (line.startsWith('emit ')) err = push(0x01, enc.encode(stripQuotes(pyStrip(line.slice(5)))));
      else if (line.startsWith('let ')) err = push(0x02, enc.encode(pyStrip(line.slice(4))));
      else if (line.startsWith('if ')) err = push(0x03, enc.encode(line.slice(3)));
      else if (line.endsWith(':')) err = push(0x04, enc.encode(line.slice(0, -1)));
      else if (line.startsWith('wait')) err = push(0x05, enc.encode('async_signal'));
      else if (line.startsWith('storage.read ')) {
        const p = stripQuotes(pyStrip(line.slice('storage.read '.length)));
        // stessa regola dell'originale, incluso il controllo letterale '\\x00'
        if (!p || p.startsWith('/') || p.includes('\\x00') || p.split('/').some((x) => x === '..')) {
          return { ok: false, line: lineNo, error: "zlangc v2.5 error: storage path fuori namespace -> '" + p + "'" };
        }
        err = push(0x06, enc.encode(p));
      } else {
        return { ok: false, line: lineNo, error: "zlangc v2.5 error: sintassi sconosciuta -> '" + line + "'" };
      }
      if (err) return err;
    }
    map.push({ offset: bytes.length, op: 0xff, line: null });
    bytes.push(0xff, 0, 0); // HALT
    const bin = new Uint8Array(bytes);
    return { ok: true, bytecode: bin, instructions: count, map, header: header(bin) };
  }

  function header(bin) {
    const hex = Array.from(bin, (b) => '0x' + b.toString(16)).join(', ');
    return '/* Z-LANG V2.5 ALU HEADER */\n#ifndef ZLANG_PROGRAM_H\n#define ZLANG_PROGRAM_H\n\n' +
      'static const unsigned char zlang_bytecode[] = {\n    ' + hex + '\n};\n\n#endif\n';
  }

  const OPS = { 0x01: 'EMIT', 0x02: 'ASSIGN', 0x03: 'JUMP_IF', 0x04: 'LABEL', 0x05: 'WAIT', 0x06: 'STORAGE_READ', 0xff: 'HALT' };
  function disassemble(bin) {
    const out = [];
    const dec = new TextDecoder();
    let i = 6;
    while (i < bin.length) {
      const op = bin[i]; const len = bin[i + 1] | (bin[i + 2] << 8);
      const payload = dec.decode(bin.slice(i + 3, i + 3 + len));
      out.push({ offset: i, op, name: OPS[op] || 'UNK', payload });
      i += 3 + len;
      if (op === 0xff) break;
    }
    return out;
  }
  root.ZLangC = { compile, disassemble, header, OPS, version: 'zlangc v2.5 (port JS)' };
})(typeof window !== 'undefined' ? window : globalThis);
