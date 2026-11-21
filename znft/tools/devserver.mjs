// Server locale che imita nginx: /znft/ statico, /znft/api/ -> 127.0.0.1:4190, /_shared/ dal sito velvet.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ADMIN = process.env.ZNFT_ADMIN_KEY; const SH = "/workspace/final-sync/zSWAP/velvet-site/site/_shared";
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".zlb": "application/octet-stream", ".zlang": "text/plain; charset=utf-8", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/znft/api/")) {
    const h = { ...req.headers }; delete h["x-znft-admin"]; if (u.pathname.startsWith("/znft/api/admin/")) h["x-znft-admin"] = ADMIN;
    const p = http.request({ host: "127.0.0.1", port: 4190, path: req.url, method: req.method, headers: h }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }); req.pipe(p); p.on("error", () => { res.writeHead(502); res.end(); }); return;
  }
  let f = null; if (u.pathname.startsWith("/znft/")) f = path.join("/workspace/znft/site", u.pathname.slice(6)); else if (u.pathname.startsWith("/_shared/")) f = path.join(SH, u.pathname.slice(9));
  if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f || !fs.existsSync(f)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream", "content-security-policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'" }); fs.createReadStream(f).pipe(res);
}).listen(8932, "127.0.0.1", () => console.log("dev 8932"));
