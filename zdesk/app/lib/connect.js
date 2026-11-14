'use strict';

/**
 * ZDOS Radar · Connetti app (sola lettura).
 * Tre collegamenti soltanto: X (link al profilo pubblico), GitHub (stato pubblico
 * dell'organizzazione), Phantom (solo indirizzo pubblico, gestito nel browser).
 * Nessun post, nessuna firma, nessuna transazione, nessun token salvato sul server.
 */
const { httpJson } = require('./sources');
const { cache } = require('./cache');

const GITHUB_ORG = process.env.ZDESK_GITHUB_ORG || 'high-cde';
const GITHUB_REPO = process.env.ZDESK_GITHUB_REPO || 'z-xSOLANA';
const TTL_MS = 30 * 60_000;

async function getGithubStatus() {
  const key = 'connect:github';
  const hit = cache.fresh(key);
  if (hit) return hit;
  const out = {
    org: GITHUB_ORG,
    repo: GITHUB_REPO,
    orgUrl: 'https://github.com/' + GITHUB_ORG,
    repoUrl: 'https://github.com/' + GITHUB_ORG + '/' + GITHUB_REPO,
    repoPrivate: true,
    publicRepos: null,
    updatedAt: null,
    checkedAt: new Date().toISOString(),
    error: null,
  };
  try {
    const u = await httpJson('https://api.github.com/users/' + encodeURIComponent(GITHUB_ORG), {
      timeout: 8000,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'zdesk-radar' },
    });
    out.publicRepos = Number.isFinite(u.public_repos) ? u.public_repos : null;
    out.updatedAt = u.updated_at || null;
  } catch (e) {
    out.error = String(e.message || e);
  }
  return cache.set(key, out, TTL_MS);
}

module.exports = { getGithubStatus, GITHUB_ORG, GITHUB_REPO };
