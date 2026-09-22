import type { ISODate } from '@/types';

/** Date helpers. All calendar days use the local timezone and `YYYY-MM-DD` keys. */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromISODate(value: ISODate): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = fromISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(value: ISODate, months: number): ISODate {
  const date = fromISODate(value);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = fromISODate(from).getTime();
  const b = fromISODate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Monday-based week start (configurable elsewhere in the UI). */
export function startOfWeek(value: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const date = fromISODate(value);
  const day = date.getDay();
  const delta = (day - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - delta);
  return toISODate(date);
}

export function startOfMonth(value: ISODate): ISODate {
  const date = fromISODate(value);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function rangeOfDays(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  const span = diffDays(from, to);
  for (let index = 0; index <= span; index += 1) days.push(addDays(from, index));
  return days;
}

/** Last `count` days ending today (inclusive), oldest first. */
export function lastNDays(count: number, end: ISODate = todayISO()): ISODate[] {
  const days: ISODate[] = [];
  for (let index = count - 1; index >= 0; index -= 1) days.push(addDays(end, -index));
  return days;
}

export function formatDate(value: ISODate, style: 'short' | 'medium' | 'long' | 'day' = 'medium'): string {
  const date = fromISODate(value);
  const day = date.getDate();
  const month = MONTH_LABELS[date.getMonth()];
  switch (style) {
    case 'short':
      return `${day} ${month.slice(0, 3)}`;
    case 'long':
      return `${DAY_LABELS_LONG[date.getDay()]}, ${day} ${month} ${date.getFullYear()}`;
    case 'day':
      return `${DAY_LABELS[date.getDay()]} ${day} ${month.slice(0, 3)}`;
    case 'medium':
    default:
      return `${day} ${month} ${date.getFullYear()}`;
  }
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(months / 12)} year${months >= 18 ? 's' : ''} ago`;
}

export function dayLabel(value: ISODate, style: 'short' | 'long' = 'short'): string {
  const day = fromISODate(value).getDay();
  return style === 'short' ? DAY_LABELS[day] : DAY_LABELS_LONG[day];
}

export function monthLabel(value: ISODate, style: 'short' | 'long' = 'short'): string {
  const month = MONTH_LABELS[fromISODate(value).getMonth()];
  return style === 'short' ? month.slice(0, 3) : month;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
