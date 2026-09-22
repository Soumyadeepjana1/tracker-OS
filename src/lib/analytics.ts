import type {
  Course,
  DayPlan,
  ISODate,
  Note,
  Project,
  RevisionRecord,
  Settings,
  StreakInfo,
  StudySession,
  StudyTask,
  SubjectProgress,
  TaskStats,
  Topic,
} from '@/types';
import { HEADLINE_SUBJECTS } from '@/types';
import {
  addDays,
  lastNDays,
  monthLabel,
  startOfMonth,
  startOfWeek,
  todayISO,
  toISODate,
  fromISODate,
} from './date';
import {
  buildDayPlan,
  categoryProgress,
  courseCounts,
  needsRevision,
  overallProgress,
  projectProgress,
  revisionUrgency,
  subjectProgress,
  taskStats,
} from './progress';
import { computeStreak } from './streak';
import { formatMinutes, percent, round1, sum, unique } from './utils';

export interface AnalyticsInput {
  courses: Course[];
  topics: Topic[];
  tasks: StudyTask[];
  projects: Project[];
  notes: Note[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  settings: Settings;
}

export interface SeriesPoint {
  label: string;
  value: number;
  date: ISODate;
}

export interface HeatmapCell {
  date: ISODate;
  minutes: number;
  tasks: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface CourseSummary {
  course: Course;
  progress: number;
  totalModules: number;
  completedModules: number;
  remainingModules: number;
}

export interface ProjectSummary {
  project: Project;
  progress: number;
  done: number;
  total: number;
}

export interface Analytics {
  today: DayPlan;
  streak: StreakInfo;
  activeDays: ISODate[];
  studyMinutesByDay: Record<ISODate, number>;
  minutesToday: number;
  minutesYesterday: number;
  minutesThisWeek: number;
  minutesThisMonth: number;
  minutesTotal: number;
  minutesLast7: number;
  dailyAverage: number;
  targetToday: number;
  todayProgress: number;
  weekTarget: number;
  weekProgress: number;
  monthTarget: number;
  monthProgress: number;
  overall: number;
  subjectProgress: SubjectProgress[];
  categoryProgress: SubjectProgress[];
  courseSummaries: CourseSummary[];
  projectSummaries: ProjectSummary[];
  courseProgressAverage: number;
  projectProgressAverage: number;
  topicStats: {
    total: number;
    notStarted: number;
    learning: number;
    practiced: number;
    completed: number;
    needRevision: number;
    averageConfidence: number;
  };
  overallTaskStats: TaskStats;
  todayTaskStats: TaskStats;
  weekTaskStats: TaskStats;
  revisionTopics: Topic[];
  recentNotes: Note[];
  notesCount: number;
  archivedNotesCount: number;
  dailySeries: SeriesPoint[];
  weeklySeries: SeriesPoint[];
  monthlySeries: SeriesPoint[];
  subjectMinutesSeries: SeriesPoint[];
  heatmap: HeatmapCell[];
  consistency: number;
  daysUntilTarget: number | null;
  focusSuggestion: { title: string; reason: string; minutes: number } | null;
}

/**
 * Canonical per-day study minutes.
 *
 * Study sessions are the source of truth. Days that only carry manually entered
 * task durations (typed directly in the planner, or restored from a backup that
 * has no sessions) fall back to the completed-task minutes. The two are never
 * summed, which keeps the timer-driven flow free of double counting.
 */
export function buildStudyMinutesByDay(input: AnalyticsInput): Record<ISODate, number> {
  const byDay: Record<ISODate, number> = {};

  for (const session of input.sessions) {
    byDay[session.date] = (byDay[session.date] ?? 0) + Math.max(0, session.minutes);
  }

  const taskMinutes: Record<ISODate, number> = {};
  for (const task of input.tasks) {
    if (task.status !== 'completed') continue;
    taskMinutes[task.date] = (taskMinutes[task.date] ?? 0) + Math.max(0, task.actualMinutes);
  }

  for (const [date, minutes] of Object.entries(taskMinutes)) {
    if (!byDay[date]) byDay[date] = minutes;
  }

  return byDay;
}

function taskMinutesInRange(tasks: StudyTask[], from: ISODate, to: ISODate): number {
  return sum(
    tasks
      .filter((task) => task.date >= from && task.date <= to && task.status === 'completed')
      .map((task) => task.actualMinutes || task.plannedMinutes),
  );
}

function rangeStats(tasks: StudyTask[], from: ISODate, to: ISODate): TaskStats {
  return taskStats(tasks.filter((task) => task.date >= from && task.date <= to));
}

export function computeAnalytics(input: AnalyticsInput): Analytics {
  const today = todayISO();
  const { settings } = input;

  const studyMinutesByDay = buildStudyMinutesByDay(input);
  const activeDays = unique([
    ...Object.entries(studyMinutesByDay)
      .filter(([, minutes]) => minutes > 0)
      .map(([date]) => date),
    ...input.tasks.filter((task) => task.status === 'completed').map((task) => task.date),
    ...input.revisions.map((revision) => revision.date),
  ]);

  const streak = computeStreak(activeDays, today);
  const dayPlan = buildDayPlan(today, input.tasks, settings.dailyStudyTargetMinutes);

  const minutesOn = (date: ISODate) => studyMinutesByDay[date] ?? 0;

  const weekStart = startOfWeek(today, settings.weekStartsOn);
  const monthStart = startOfMonth(today);

  const minutesThisWeek =
    sum(Object.entries(studyMinutesByDay).filter(([date]) => date >= weekStart && date <= today).map(([, m]) => m)) ||
    taskMinutesInRange(input.tasks, weekStart, today);
  const minutesThisMonth =
    sum(Object.entries(studyMinutesByDay).filter(([date]) => date >= monthStart && date <= today).map(([, m]) => m)) ||
    taskMinutesInRange(input.tasks, monthStart, today);
  const minutesTotal = sum(Object.values(studyMinutesByDay));

  const last7 = lastNDays(7, today);
  const minutesLast7 = sum(last7.map(minutesOn));

  const dailySeries: SeriesPoint[] = lastNDays(14, today).map((date) => ({
    date,
    label: `${fromISODate(date).getDate()}`,
    value: round1(minutesOn(date) / 60),
  }));

  const weeklySeries: SeriesPoint[] = Array.from({ length: 8 }, (_, index) => {
    const weekStartDate = addDays(weekStart, -7 * (7 - index));
    const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStartDate, offset));
    return {
      date: weekStartDate,
      label: `${fromISODate(weekStartDate).getDate()}/${fromISODate(weekStartDate).getMonth() + 1}`,
      value: round1(sum(days.map(minutesOn)) / 60),
    };
  });

  const monthlySeries: SeriesPoint[] = Array.from({ length: 6 }, (_, index) => {
    const reference = fromISODate(addDays(monthStart, -30 * (5 - index)));
    const monthStartDate = toISODate(new Date(reference.getFullYear(), reference.getMonth(), 1));
    const monthEndDate = toISODate(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
    const minutes = sum(
      Object.entries(studyMinutesByDay)
        .filter(([date]) => date >= monthStartDate && date <= monthEndDate)
        .map(([, value]) => value),
    );
    return { date: monthStartDate, label: monthLabel(monthStartDate), value: round1(minutes / 60) };
  });

  const subjectTotals = new Map<string, number>();
  for (const session of input.sessions) {
    subjectTotals.set(session.subject, (subjectTotals.get(session.subject) ?? 0) + session.minutes);
  }
  if (!subjectTotals.size) {
    for (const task of input.tasks) {
      if (task.status !== 'completed') continue;
      subjectTotals.set(task.subject, (subjectTotals.get(task.subject) ?? 0) + (task.actualMinutes || task.plannedMinutes));
    }
  }
  const subjectMinutesSeries: SeriesPoint[] = Array.from(subjectTotals.entries())
    .map(([label, minutes]) => ({ label, value: round1(minutes / 60), date: today }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const heatmap = buildHeatmap(studyMinutesByDay, input.tasks, today);

  const windowDays = 28;
  const windowStart = addDays(today, -(windowDays - 1));
  const activeInWindow = new Set(
    Object.keys(studyMinutesByDay).filter(
      (date) => date >= windowStart && date <= today && (studyMinutesByDay[date] ?? 0) > 0,
    ),
  );

  const courseSummaries: CourseSummary[] = input.courses.map((course) => {
    const counts = courseCounts(course);
    return {
      course,
      progress: counts.progress,
      totalModules: counts.totalModules,
      completedModules: counts.completedModules,
      remainingModules: counts.remainingModules,
    };
  });

  const projectSummaries: ProjectSummary[] = input.projects.map((project) => {
    const done = project.tasks.filter((task) => task.done).length;
    return { project, progress: projectProgress(project), done, total: project.tasks.length };
  });

  const revisionTopics = input.topics
    .filter((topic) => needsRevision(topic, today))
    .sort((a, b) => revisionUrgency(b, today) - revisionUrgency(a, today));

  const topicStats = {
    total: input.topics.length,
    notStarted: input.topics.filter((topic) => topic.status === 'not-started').length,
    learning: input.topics.filter((topic) => topic.status === 'learning').length,
    practiced: input.topics.filter((topic) => topic.status === 'practiced').length,
    completed: input.topics.filter((topic) => topic.status === 'completed').length,
    needRevision: revisionTopics.length,
    averageConfidence: input.topics.length
      ? round1(sum(input.topics.map((topic) => topic.confidence)) / input.topics.length)
      : 0,
  };

  const targetToday = settings.dailyStudyTargetMinutes;
  const minutesToday = minutesOn(today);
  const minutesYesterday = minutesOn(addDays(today, -1));

  const daysUntilTarget = settings.targetJobDate
    ? Math.round((fromISODate(settings.targetJobDate).getTime() - fromISODate(today).getTime()) / 86_400_000)
    : null;

  const weakestSubject = [...categoryProgress(input.topics)].sort((a, b) => a.progress - b.progress)[0];

  return {
    today: dayPlan,
    streak,
    activeDays,
    studyMinutesByDay,
    minutesToday,
    minutesYesterday,
    minutesThisWeek,
    minutesThisMonth,
    minutesTotal,
    minutesLast7,
    dailyAverage: round1(minutesLast7 / 7),
    targetToday,
    todayProgress: percent(minutesToday, targetToday),
    weekTarget: settings.weeklyStudyTargetMinutes,
    weekProgress: percent(minutesThisWeek, settings.weeklyStudyTargetMinutes),
    monthTarget: settings.weeklyStudyTargetMinutes * 4,
    monthProgress: percent(minutesThisMonth, settings.weeklyStudyTargetMinutes * 4),
    overall: overallProgress(input),
    subjectProgress: subjectProgress(input.topics, HEADLINE_SUBJECTS),
    categoryProgress: categoryProgress(input.topics),
    courseSummaries,
    projectSummaries,
    courseProgressAverage: courseSummaries.length
      ? Math.round(sum(courseSummaries.map((entry) => entry.progress)) / courseSummaries.length)
      : 0,
    projectProgressAverage: projectSummaries.length
      ? Math.round(sum(projectSummaries.map((entry) => entry.progress)) / projectSummaries.length)
      : 0,
    topicStats,
    overallTaskStats: taskStats(input.tasks),
    todayTaskStats: dayPlan.stats,
    weekTaskStats: rangeStats(input.tasks, weekStart, today),
    revisionTopics,
    recentNotes: [...input.notes]
      .filter((note) => !note.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5),
    notesCount: input.notes.filter((note) => !note.archived).length,
    archivedNotesCount: input.notes.filter((note) => note.archived).length,
    dailySeries,
    weeklySeries,
    monthlySeries,
    subjectMinutesSeries,
    heatmap,
    consistency: percent(activeInWindow.size, windowDays),
    daysUntilTarget,
    focusSuggestion:
      (() => {
        const nextTask = dayPlan.tasks.find(
          (task) => task.status === 'pending' || task.status === 'in-progress',
        );
        if (nextTask) {
          return {
            title: nextTask.title,
            reason: `${nextTask.subject} · ${nextTask.priority} priority · planned for ${formatMinutes(nextTask.plannedMinutes)}`,
            minutes: nextTask.plannedMinutes,
          };
        }
        return null;
      })() ??
      (revisionTopics[0]
        ? {
            title: `Revise ${revisionTopics[0].name}`,
            reason: 'Flagged for revision — spaced repetition keeps it from fading.',
            minutes: 25,
          }
        : weakestSubject && weakestSubject.total > 0
          ? {
              title: `Push forward on ${weakestSubject.subject}`,
              reason: `Your weakest area right now at ${weakestSubject.progress}% mastery.`,
              minutes: 45,
            }
          : null),
  };
}

/**
 * GitHub-style activity grid: `weeks` columns of 7 days, oldest first, aligned
 * so each row is a weekday.
 */
export function buildHeatmap(
  minutesByDay: Record<ISODate, number>,
  tasks: StudyTask[],
  today: ISODate = todayISO(),
  weeks = 26,
): HeatmapCell[] {
  const todayWeekStart = startOfWeek(today, 1);
  const firstWeekStart = addDays(todayWeekStart, -7 * (weeks - 1));
  const completedByDay = new Map<ISODate, number>();
  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    completedByDay.set(task.date, (completedByDay.get(task.date) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  for (let index = 0; index < weeks * 7; index += 1) {
    const date = addDays(firstWeekStart, index);
    if (date > today) break;
    const minutes = minutesByDay[date] ?? 0;
    const completedTasks = completedByDay.get(date) ?? 0;
    cells.push({ date, minutes, tasks: completedTasks, level: heatLevel(minutes) });
  }
  return cells;
}

function heatLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 150) return 3;
  return 4;
}
