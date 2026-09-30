import NodeCache from 'node-cache';

// In-process cache. useClones:false avoids deep-copying large list payloads;
// cached values must be treated as read-only (we never mutate them).
const store = new NodeCache({ stdTTL: 30, checkperiod: 60, useClones: false });

/** Return the cached value for `key`, or compute + cache it for `ttlSeconds`. */
export async function remember(key, ttlSeconds, compute) {
  const hit = store.get(key);
  if (hit !== undefined) return hit;
  const value = await compute();
  store.set(key, value, ttlSeconds);
  return value;
}

/** Drop every key that starts with `prefix` (called after any claim write). */
export function invalidate(prefix) {
  store.del(store.keys().filter((k) => k.startsWith(prefix)));
}
