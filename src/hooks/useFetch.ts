import { useCallback, useEffect, useRef, useState } from 'react';

interface FetchState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

interface UseFetchOptions {
  /** Set to false to skip the initial fetch */
  enabled?: boolean;
}

/**
 * Minimal data-fetching hook with:
 * - Automatic abort on unmount / re-fetch
 * - Stale data preserved while reloading
 * - Stable `reload` callback
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseFetchOptions = {},
) {
  const { enabled = true } = options;
  const [state, setState] = useState<FetchState<T>>({ data: undefined, loading: enabled, error: null });
  const abortRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: !silent, error: null }));

    try {
      const data = await fetcherRef.current();
      if (!controller.signal.aborted) {
        setState({ data, loading: false, error: null });
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setState((prev) => ({ ...prev, data: prev.data ?? undefined, loading: false, error: msg }));
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { ...state, reload: run };
}
