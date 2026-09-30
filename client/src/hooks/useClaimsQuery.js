import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** Fetches a page of claims; cancels stale requests and keeps old data visible while refetching. */
export function useClaimsQuery(params) {
  const key = JSON.stringify(params);
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .listClaims(JSON.parse(key), controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: err.message }));
      });
    return () => controller.abort();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
