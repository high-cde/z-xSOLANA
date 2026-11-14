
'use strict';

const fs = require('fs');
const path = require('path');
const { cache } = require('./cache');
const { mdToHtml } = require('./markdown');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';

const FILES = {
  risk: 'risk.md',
  go: 'go.md',
  survivors: 'survivors.md',
  signals: 'gmgn-signals.md',
};

function readSafe(name) {
  const p = path.join(DESK_DIR, name);
  const resolved = path.resolve(p);
  if (!resolved.startsWith(path.resolve(DESK_DIR) + path.sep) && resolved !== path.resolve(DESK_DIR)) {
    throw new Error('path non consentito');
  }
  return fs.readFileSync(resolved, 'utf8');
}

function mtimeIso(name) {
  try {
    return fs.statSync(path.join(DESK_DIR, name)).mtime.toISOString();
  } catch {
    return null;
  }
}

function getDesk() {
  const key = 'desk';
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  const sections = {};
  for (const [k, file] of Object.entries(FILES)) {
    try {
      let raw = readSafe(file);
      const truncated = k === 'signals' && raw.split('\n').length > 80;
      const html = mdToHtml(raw, k === 'signals' ? { maxLines: 80 } : {});
      sections[k] = {
        file,
        mtime: mtimeIso(file),
        html,
        truncated,
        missing: false,
      };
    } catch (e) {
      sections[k] = {
        file,
        mtime: null,
        html: '<p class="muted">File non trovato o non leggibile: ' + file + '</p>',
        truncated: false,
        missing: true,
        error: e.message,
      };
    }
  }
  const payload = {
    updatedAt: new Date().toISOString(),
    deskDir: DESK_DIR,
    sections,
  };
  cache.set(key, payload, 15_000);
  return payload;
}

module.exports = { getDesk, DESK_DIR, FILES };
