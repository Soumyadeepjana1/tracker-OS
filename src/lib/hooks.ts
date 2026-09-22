import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Honours the OS "reduce motion" setting.
 *
 * Every animated effect in the app checks this so the HUD layer stays optional
 * rather than distracting for users who prefer stillness.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReduced(query.matches);
    listener();
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reduced;
}

/** Ticking clock for the mission-control HUD (updates once per second). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

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
