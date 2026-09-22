import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Debounces a rapidly changing value (search inputs). */
export function useDebounced<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Reads a query-string value (`?new=task`) and can clear it after use. */
export function useQueryFlag(key: string): [string | null, (value?: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key);

  const update = useCallback(
    (next?: string) => {
      setParams(
        (current) => {
          const draft = new URLSearchParams(current);
          if (next === undefined) draft.delete(key);
          else draft.set(key, next);
          return draft;
        },
        { replace: true },
      );
    },
    [key, setParams],
  );

  return [value, update];
}
