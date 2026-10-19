import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Minimal data hook: `const { data, loading, error, reload, setData } = useFetch('/products')`. */
export function useFetch(url, { keepPrevious = true } = {}) {
  const [state, setState] = useState({ data: null, loading: !!url, error: null });
  const latest = useRef(url);

  const load = useCallback(async () => {
    if (!url) return;
    latest.current = url;
    setState((s) => ({ data: keepPrevious ? s.data : null, loading: true, error: null }));
    try {
      const data = await api.get(url);
      if (latest.current === url) setState({ data, loading: false, error: null });
    } catch (error) {
      if (latest.current === url) setState((s) => ({ data: s.data, loading: false, error }));
    }
  }, [url, keepPrevious]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: load, setData };
}
