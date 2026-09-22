import type { Course, Note, Project, StudyTask, Topic } from '@/types';
import type { Analytics } from '@/lib/analytics';
import { formatMinutes } from '@/lib/utils';
import { courseCounts, projectProgress } from '@/lib/progress';

/**
 * Builds a *compact, bounded* snapshot of the learner's state for the model.
 *
 * Only the fields the assistant needs are included and every list is capped, so
 * the prompt stays small (important for local models with a short context) and
 * no unrelated personal data is ever sent.
 */

export interface ContextInput {
  analytics: Analytics;
  courses: Course[];
  topics: Topic[];
  tasks: StudyTask[];
  projects: Project[];
  notes: Note[];
  learnerName: string;
  githubUsername: string;
  githubRepos: { name: string; language: string; stars: number; updatedAt: string }[];
}

export function buildContextSnapshot(input: ContextInput): Record<string, unknown> {
  const { analytics } = input;

  return {
    learner: input.learnerName || 'unnamed',
    today: analytics.today.date,
    targets: {
      dailyMinutes: analytics.targetToday,
      weeklyMinutes: analytics.weekTarget,
      daysUntilTargetDate: analytics.daysUntilTarget,
    },
    progress: {
      overallPercent: analytics.overall,
      todayPercent: analytics.todayProgress,
      weekPercent: analytics.weekProgress,
      monthPercent: analytics.monthProgress,
      minutesToday: analytics.minutesToday,
      minutesThisWeek: analytics.minutesThisWeek,
      minutesTotal: analytics.minutesTotal,
      totalHours: Math.round(analytics.minutesTotal / 60),
      consistency28dPercent: analytics.consistency,
    },
    streak: {
      current: analytics.streak.current,
      longest: analytics.streak.longest,
      lastActiveDate: analytics.streak.lastActiveDate,
    },
    tasks: {
      today: analytics.today.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        subject: task.subject,
        topic: task.topic,
        status: task.status,
        priority: task.priority,
        plannedMinutes: task.plannedMinutes,
      })),
      todayStats: analytics.todayTaskStats,
      overallStats: analytics.overallTaskStats,
      upcoming: input.tasks
        .filter((task) => task.date > analytics.today.date && task.status !== 'completed')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8)
        .map((task) => ({ date: task.date, title: task.title, subject: task.subject, priority: task.priority })),
      overdue: input.tasks
        .filter((task) => task.date < analytics.today.date && task.status === 'pending')
        .slice(0, 8)
        .map((task) => ({ date: task.date, title: task.title, subject: task.subject })),
    },
    courses: input.courses.slice(0, 12).map((course) => {
      const counts = courseCounts(course);
      return {
        id: course.id,
        name: course.name,
        platform: course.platform,
        progress: counts.progress,
        completedModules: counts.completedModules,
        totalModules: counts.totalModules,
        status: course.status,
      };
    }),
    topics: {
      summary: analytics.topicStats,
      weakest: [...analytics.categoryProgress].sort((a, b) => a.progress - b.progress).slice(0, 6),
      strongest: [...analytics.categoryProgress].sort((a, b) => b.progress - a.progress).slice(0, 4),
      needsRevision: analytics.revisionTopics.slice(0, 10).map((topic) => ({
        id: topic.id,
        name: topic.name,
        category: topic.category,
        confidence: topic.confidence,
        nextRevisionAt: topic.nextRevisionAt ?? null,
        status: topic.status,
      })),
    },
    projects: input.projects.slice(0, 10).map((project) => ({
      id: project.id,
      name: project.name,
      progress: projectProgress(project),
      status: project.status,
      targetDate: project.targetDate,
      openTasks: project.tasks.filter((task) => !task.done).map((task) => task.title),
    })),
    notes: {
      count: analytics.notesCount,
      recentTitles: input.notes
        .filter((note) => !note.archived)
        .slice(0, 8)
        .map((note) => ({ id: note.id, title: note.title, topic: note.topic })),
    },
    github: {
      username: input.githubUsername || null,
      repositories: input.githubRepos.slice(0, 12),
    },
    focusSuggestion: analytics.focusSuggestion,
  };
}

/** Renders the snapshot as deterministic prose used by the offline planner. */
export function describeProgressForHumans(analytics: Analytics, name: string): string {
  const lines: string[] = [];
  const who = name ? `${name}, ` : '';

  lines.push(
    `${who}you are at **${analytics.overall}% overall**, with **${formatMinutes(analytics.minutesToday)}** studied today against a ${formatMinutes(analytics.targetToday)} target.`,
  );
  lines.push(
    `Streak: **${analytics.streak.current} day(s)** (longest ${analytics.streak.longest}). This week: ${formatMinutes(analytics.minutesThisWeek)} of ${formatMinutes(analytics.weekTarget)}.`,
  );
  lines.push(
    `Tasks today: ${analytics.todayTaskStats.completed}/${analytics.todayTaskStats.total} complete · ${analytics.todayTaskStats.pending} pending.`,
  );

  if (analytics.revisionTopics.length) {
    lines.push(
      `Revision backlog (${analytics.revisionTopics.length}): ${analytics.revisionTopics
        .slice(0, 5)
        .map((topic) => topic.name)
        .join(', ')}.`,
    );
  }

  const weak = [...analytics.categoryProgress].sort((a, b) => a.progress - b.progress).slice(0, 3);
  if (weak.length) {
    lines.push(`Weakest areas: ${weak.map((entry) => `${entry.subject} (${entry.progress}%)`).join(', ')}.`);
  }

  const unfinished = analytics.courseSummaries.filter((entry) => entry.progress < 100).slice(0, 4);
  if (unfinished.length) {
    lines.push(
      `Unfinished courses: ${unfinished.map((entry) => `${entry.course.name} ${entry.progress}%`).join('; ')}.`,
    );
  }

  if (analytics.daysUntilTarget !== null) {
    lines.push(
      analytics.daysUntilTarget >= 0
        ? `Target date is in ${analytics.daysUntilTarget} day(s).`
        : `The target date passed ${Math.abs(analytics.daysUntilTarget)} day(s) ago — worth re-planning.`,
    );
  }

  return lines.join('\n');
}

/** A tiny digest used in the search palette and dashboard "what's next" card. */
export function summarizeNextActions(analytics: Analytics): string[] {
  const actions: string[] = [];
  const pending = analytics.today.tasks.filter((task) => task.status === 'pending' || task.status === 'in-progress');
  for (const task of pending.slice(0, 3)) {
    actions.push(`${task.title} — ${formatMinutes(task.plannedMinutes)} (${task.subject})`);
  }
  if (analytics.revisionTopics[0]) {
    actions.push(`Revise ${analytics.revisionTopics[0].name} — confidence ${analytics.revisionTopics[0].confidence}/5`);
  }
  const stalled = analytics.courseSummaries.filter((entry) => entry.progress > 0 && entry.progress < 100)[0];
  if (stalled) {
    actions.push(`Continue ${stalled.course.name} — ${stalled.remainingModules} module(s) left`);
  }
  return actions;
}
