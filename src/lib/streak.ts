import type { ISODate, StreakInfo } from '@/types';
import { diffDays, todayISO } from './date';

/**
 * Computes the current/longest study streak from a set of active days.
 *
 * The current streak is allowed to "rest" on today until the learner studies:
 * a run that ends yesterday still counts, so the streak is not shown as broken
 * before the day is over.
 */
export function computeStreak(activeDays: ISODate[], today: ISODate = todayISO()): StreakInfo {
  const unique = Array.from(new Set(activeDays)).sort();
  if (!unique.length) {
    return { current: 0, longest: 0, activeDays: [], lastActiveDate: null };
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (diffDays(unique[index - 1], unique[index]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const lastActiveDate = unique[unique.length - 1];
  const gapFromToday = diffDays(lastActiveDate, today);

  let current = 0;
  if (gapFromToday <= 1) {
    current = 1;
    for (let index = unique.length - 1; index > 0; index -= 1) {
      if (diffDays(unique[index - 1], unique[index]) === 1) current += 1;
      else break;
    }
  }

  return { current, longest, activeDays: unique, lastActiveDate };
}
