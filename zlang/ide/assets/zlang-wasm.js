/* Loader del vero compilatore + VM ZLang (z-xSOLANA/zlang/src/compiler e src/vm) compilati in WASM.
 * Nessun wasm-bindgen: ABI a puntatori, vedi zlang/wasm/src/lib.rs. */
(function (root) {
  'use strict';
  let bytes = null;
  async function load(url) {
    if (!bytes) bytes = await (await fetch(url, { cache: 'no-cache' })).arrayBuffer();
    return bytes;
  }
  // Nuova istanza a ogni chiamata: un panic (trap) non lascia stato sporco.
  async function call(fn, src) {
    const { instance } = await WebAssembly.instantiate(await load('assets/zlang.wasm'), {});
    const e = instance.exports;
    const b = new TextEncoder().encode(src);
    const p = e.zl_alloc(Math.max(1, b.length));
    new Uint8Array(e.memory.buffer, p, b.length).set(b);
    let r;
    try { r = fn === 'zl_version' ? e.zl_version() : e[fn](p, b.length); }
    catch (err) { return { ok: false, error: 'La VM Rust si è fermata (panic/trap): ' + err.message }; }
    const n = new DataView(e.memory.buffer).getUint32(r, true);
    return { ok: true, text: new TextDecoder().decode(new Uint8Array(e.memory.buffer, r + 4, n)) };
  }
  root.ZLangWasm = {
    compile: (src) => call('zl_compile', src),
    run: (src) => call('zl_run', src),
    version: () => call('zl_version', ''),
  };
})(window);
