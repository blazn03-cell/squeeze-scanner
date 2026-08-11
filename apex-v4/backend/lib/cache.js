// In-memory TTL cache. Entries expire and are lazily purged.
export class Cache {
  constructor() {
    this._store = new Map();
  }

  set(key, value, ttlMs) {
    this._store.set(key, { value, expires: Date.now() + ttlMs });
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { this._store.delete(key); return null; }
    return entry.value;
  }

  delete(key) {
    this._store.delete(key);
  }

  purgeExpired() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now > v.expires) this._store.delete(k);
    }
  }

  size() { return this._store.size; }
}
