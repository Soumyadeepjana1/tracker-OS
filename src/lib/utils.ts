/** Small, dependency-free helpers shared across the app. */

/** Conditional class-name joiner. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** Collision-resistant id for local-first data. */
export function uid(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${prefix ? '_' : ''}${time}${random}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to at most 1 decimal place without trailing `.0`. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Formats minutes as `2h 30m`, `45m` or `0m`. */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** Formats minutes as decimal hours, e.g. `2.5h`. */
export function formatHours(minutes: number): string {
  return `${round1(Math.max(0, minutes) / 60)}h`;
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

export function downloadFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}
