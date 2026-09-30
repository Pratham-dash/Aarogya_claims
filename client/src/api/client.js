const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'aarogya_token';
const GET_TTL_MS = 15_000;

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
  /** { fieldName: message } for inline form errors */
  fieldErrors() {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

// Client-side caches: short-lived JSON for GETs (cleared on any write),
// and permanent blobs for documents (server files are immutable).
const responseCache = new Map();
const blobCache = new Map();
export const clearApiCache = () => {
  responseCache.clear();
  blobCache.clear();
};

async function request(path, { method = 'GET', body, signal, cacheTtl = 0, blob = false } = {}) {
  const isGet = method === 'GET';
  if (isGet && cacheTtl) {
    const hit = responseCache.get(path);
    if (hit && hit.expires > Date.now()) return hit.data;
  }

  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      tokenStore.clear();
      clearApiCache();
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(data?.error?.message || `Request failed (${res.status})`, res.status, data?.error?.details);
  }

  const data = blob ? await res.blob() : await res.json();
  if (isGet && cacheTtl) responseCache.set(path, { data, expires: Date.now() + cacheTtl });
  if (!isGet) responseCache.clear();
  return data;
}

const toQuery = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && search.set(k, v));
  return search.toString();
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  listClaims: (params, signal) => request(`/claims?${toQuery(params)}`, { signal, cacheTtl: GET_TTL_MS }),
  claimStats: (signal) => request('/claims/stats', { signal, cacheTtl: GET_TTL_MS }),
  getClaim: (id, signal) => request(`/claims/${id}`, { signal }),
  createClaim: (formData) => request('/claims', { method: 'POST', body: formData }),
  reviewClaim: (id, payload) => request(`/claims/${id}/review`, { method: 'PATCH', body: payload }),
  async documentBlob(id) {
    if (!blobCache.has(id)) blobCache.set(id, await request(`/documents/${id}`, { blob: true }));
    return blobCache.get(id);
  },
};
