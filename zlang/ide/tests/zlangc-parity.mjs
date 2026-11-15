// Confronta byte per byte il port JS con tools/zlangc.py
import fs from 'fs'; import { execFileSync } from 'child_process'; import vm from 'vm';
const [,, zlangcPy, zlangcJs] = process.argv;
const ctx = { TextEncoder, TextDecoder, globalThis: {} }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(zlangcJs, 'utf8'), ctx);
const cases = [
  'emit Ciao\n', 'emit "Ciao z-xSOLANA"\nlet x = 100\nlet y = 50 + 25\n',
  '# commento\n\n  emit  \'àèì 🚀\'  \nif x == 100 jump fine\nloop:\nwait 5\nstorage.read "cfg/node.json"\nfine:\n',
  'emit a\r\nlet b = 2\r\n', 'storage.read ../etc/passwd\n', 'storage.read /abs\n', 'boh\n', 'emit x\nstorage.read a/\\x00b\n',
  fs.readFileSync(process.argv[4], 'utf8'),
];
let fail = 0;
cases.forEach((src, i) => {
  fs.writeFileSync('/tmp/c.zlang', src);
  let py = null, pyErr = null;
  try { execFileSync('python3', [zlangcPy, '/tmp/c.zlang', '--bytecode', '/tmp/c.zbin', '--header', '/tmp/c.h'], { stdio: 'pipe' }); py = fs.readFileSync('/tmp/c.zbin'); } catch (e) { pyErr = String(e.stdout).trim(); }
  const js = ctx.ZLangC.compile(src);
  let ok;
  if (py) ok = js.ok && Buffer.from(js.bytecode).equals(py) && js.header === fs.readFileSync('/tmp/c.h', 'utf8');
  else ok = !js.ok && js.error === pyErr;
  if (!ok) { fail++; console.log('FAIL case', i, { pyErr, jsErr: js.error }); }
  fs.rmSync('/tmp/c.zbin', { force: true }); fs.rmSync('/tmp/c.h', { force: true });
});
console.log(fail ? fail + ' FAIL' : 'OK: ' + cases.length + ' casi identici a zlangc.py');
process.exit(fail ? 1 : 0);
