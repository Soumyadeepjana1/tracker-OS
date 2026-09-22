import type { Analytics, AnalyticsInput } from './analytics';

/**
 * Achievement engine.
 *
 * Achievements are *derived* from the data already stored in IndexedDB — there
 * is no extra bookkeeping to keep in sync, and they survive an import/export
 * round trip for free. The UI only remembers which ones have already been
 * celebrated on this device.
 */

export type AchievementIcon =
  | 'flame'
  | 'target'
  | 'book'
  | 'rocket'
  | 'note'
  | 'zap'
  | 'star'
  | 'brain'
  | 'timer'
  | 'trend';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  tier: 'bronze' | 'silver' | 'gold';
  earned: boolean;
  /** 0–1, for the progress bar on unearned entries. */
  progress: number;
  /** Current value, formatted for display. */
  value: string;
}

function ratio(current: number, goal: number): number {
  if (goal <= 0) return 1;
  return Math.max(0, Math.min(1, current / goal));
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

export function computeAchievements(state: AnalyticsInput, analytics: Analytics): Achievement[] {
  const hours = analytics.minutesTotal / 60;
  const weekHours = analytics.minutesThisWeek / 60;
  const streak = Math.max(analytics.streak.current, 0);
  const longest = Math.max(analytics.streak.longest, 0);
  const finishedCourses = analytics.courseSummaries.filter((entry) => entry.progress >= 100);
  const finishedProjects = analytics.projectSummaries.filter((entry) => entry.progress >= 100);
  const completedTopics = analytics.topicStats.completed;
  const completedTasks = analytics.overallTaskStats.completed;

  const list: Achievement[] = [
    {
      id: 'first-session',
      title: 'Hello, world',
      description: 'Log your first study session.',
      icon: 'timer',
      tier: 'bronze',
      earned: state.sessions.length >= 1,
      progress: ratio(state.sessions.length, 1),
      value: plural(state.sessions.length, 'session'),
    },
    {
      id: 'streak-7',
      title: 'Week warrior',
      description: 'Study 7 days in a row.',
      icon: 'flame',
      tier: 'bronze',
      earned: longest >= 7,
      progress: ratio(Math.max(streak, longest), 7),
      value: `${streak}-day streak`,
    },
    {
      id: 'streak-30',
      title: 'Unbreakable',
      description: 'Reach a 30-day streak.',
      icon: 'flame',
      tier: 'gold',
      earned: longest >= 30,
      progress: ratio(Math.max(streak, longest), 30),
      value: `${longest}-day best`,
    },
    {
      id: 'hours-50',
      title: 'Deep work',
      description: 'Accumulate 50 study hours.',
      icon: 'timer',
      tier: 'bronze',
      earned: hours >= 50,
      progress: ratio(hours, 50),
      value: `${hours.toFixed(1)}h`,
    },
    {
      id: 'hours-200',
      title: 'Ten thousand reps',
      description: 'Accumulate 200 study hours.',
      icon: 'zap',
      tier: 'gold',
      earned: hours >= 200,
      progress: ratio(hours, 200),
      value: `${hours.toFixed(1)}h`,
    },
    {
      id: 'week-20',
      title: 'Sprint week',
      description: 'Study 20 hours in a single week.',
      icon: 'trend',
      tier: 'silver',
      earned: weekHours >= 20,
      progress: ratio(weekHours, 20),
      value: `${weekHours.toFixed(1)}h this week`,
    },
    {
      id: 'topics-25',
      title: 'Topic collector',
      description: 'Complete 25 topics.',
      icon: 'book',
      tier: 'silver',
      earned: completedTopics >= 25,
      progress: ratio(completedTopics, 25),
      value: `${completedTopics}/${analytics.topicStats.total} topics`,
    },
    {
      id: 'course-finisher',
      title: 'Course finisher',
      description: 'Finish every module of a course.',
      icon: 'star',
      tier: 'silver',
      earned: finishedCourses.length >= 1,
      progress: ratio(finishedCourses.length, 1),
      value: finishedCourses.length ? finishedCourses[0].course.name : 'in progress',
    },
    {
      id: 'project-shipper',
      title: 'Shipped',
      description: 'Complete a project end to end.',
      icon: 'rocket',
      tier: 'silver',
      earned: finishedProjects.length >= 1,
      progress: ratio(finishedProjects.length, 1),
      value: finishedProjects.length ? finishedProjects[0].project.name : 'in progress',
    },
    {
      id: 'tasks-100',
      title: 'Task machine',
      description: 'Complete 100 planned tasks.',
      icon: 'target',
      tier: 'silver',
      earned: completedTasks >= 100,
      progress: ratio(completedTasks, 100),
      value: `${completedTasks} tasks`,
    },
    {
      id: 'notes-25',
      title: 'Knowledge base',
      description: 'Write 25 notes.',
      icon: 'note',
      tier: 'bronze',
      earned: analytics.notesCount >= 25,
      progress: ratio(analytics.notesCount, 25),
      value: plural(analytics.notesCount, 'note'),
    },
    {
      id: 'revisions-50',
      title: 'Spaced repetition pro',
      description: 'Log 50 revisions.',
      icon: 'brain',
      tier: 'gold',
      earned: state.revisions.length >= 50,
      progress: ratio(state.revisions.length, 50),
      value: plural(state.revisions.length, 'revision'),
    },
    {
      id: 'consistency-70',
      title: 'Metronome',
      description: 'Keep 70% consistency over the last 28 days.',
      icon: 'target',
      tier: 'gold',
      earned: analytics.consistency >= 70,
      progress: ratio(analytics.consistency, 70),
      value: `${analytics.consistency}% consistent`,
    },
  ];

  return list;
}

export function earnedAchievements(list: Achievement[]): Achievement[] {
  return list.filter((entry) => entry.earned);
}

/* --------------------------- celebration memory --------------------------- */

const SEEN_KEY = 'devops-os:achievements-seen';

/**
 * Returns the achievements unlocked since the last visit and records the new
 * set. Keeps the celebration honest: it fires once per achievement per device.
 */
export function rememberAchievements(list: Achievement[]): { newlyEarned: Achievement[]; earnedCount: number } {
  const earned = earnedAchievements(list);
  const ids = earned.map((entry) => entry.id);

  let previous: string[] | null = null;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    previous = raw ? (JSON.parse(raw) as string[]) : null;
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — nothing is celebrated, nothing breaks */
  }

  // First ever run: everything already earned is pre-existing progress, so the
  // user is not spammed with a dozen toasts on day one.
  const newlyEarned = previous === null ? [] : earned.filter((entry) => !previous?.includes(entry.id));

  return { newlyEarned, earnedCount: earned.length };
}

export function forgetSeenAchievements(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}
