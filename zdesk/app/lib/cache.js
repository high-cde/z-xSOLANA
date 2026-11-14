'use strict';

/**
 * In-memory TTL cache with stale-if-error / stale-while-revalidate helpers.
 */
class TtlCache {
  constructor() {
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return null;
    return hit;
  }

  fresh(key) {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) return null;
    return hit.value;
  }

  stale(key) {
    const hit = this.map.get(key);
    return hit ? hit.value : null;
  }

  set(key, value, ttlMs) {
    this.map.set(key, {
      value,
      expires: Date.now() + ttlMs,
      storedAt: Date.now(),
    });
    return value;
  }

  ageMs(key) {
    const hit = this.map.get(key);
    return hit ? Date.now() - hit.storedAt : null;
  }
}

const cache = new TtlCache();
module.exports = { cache, TtlCache };
