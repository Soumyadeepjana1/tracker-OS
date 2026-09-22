import type {
  Course,
  DayPlan,
  ISODate,
  Project,
  StudyTask,
  SubjectProgress,
  TaskStats,
  Topic,
} from '@/types';
import { percent, sum } from './utils';

/* ------------------------------- courses ------------------------------ */

export interface CourseCounts {
  totalModules: number;
  completedModules: number;
  remainingModules: number;
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

/**
 * Course progress is derived from the module/lesson tree when the learner has
 * broken the course down, otherwise from the manual module counters.
 */
export function courseCounts(course: Course): CourseCounts {
  const lessons = course.modules.flatMap((module) => module.lessons);
  const hasStructuredModules = course.modules.length > 0 && lessons.length > 0;

  if (hasStructuredModules) {
    const completedLessons = lessons.filter((lesson) => lesson.status === 'completed').length;
    // A module counts as complete when every one of its lessons is complete.
    const completedModules = course.modules.filter(
      (module) => module.lessons.length > 0 && module.lessons.every((lesson) => lesson.status === 'completed'),
    ).length;
    return {
      totalModules: course.modules.length,
      completedModules,
      remainingModules: course.modules.length - completedModules,
      totalLessons: lessons.length,
      completedLessons,
      progress: percent(completedLessons, lessons.length),
    };
  }

  return {
    totalModules: course.totalModules,
    completedModules: course.completedModules,
    remainingModules: Math.max(0, course.totalModules - course.completedModules),
    totalLessons: 0,
    completedLessons: 0,
    progress: percent(course.completedModules, course.totalModules),
  };
}

/* ------------------------------- projects ----------------------------- */

export function projectProgress(project: Project): number {
  if (!project.tasks.length) return project.status === 'completed' ? 100 : 0;
  return percent(project.tasks.filter((task) => task.done).length, project.tasks.length);
}

export function projectCounts(project: Project): { total: number; done: number; remaining: number } {
  const done = project.tasks.filter((task) => task.done).length;
  return { total: project.tasks.length, done, remaining: project.tasks.length - done };
}

/* -------------------------------- tasks ------------------------------- */

export function taskStats(tasks: StudyTask[]): TaskStats {
  const completed = tasks.filter((task) => task.status === 'completed');
  const total = tasks.length;
  return {
    total,
    completed: completed.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in-progress').length,
    skipped: tasks.filter((task) => task.status === 'skipped').length,
    completionRate: percent(completed.length, total),
    plannedMinutes: sum(tasks.map((task) => task.plannedMinutes)),
    actualMinutes: sum(tasks.map((task) => task.actualMinutes)),
  };
}

export function buildDayPlan(date: ISODate, tasks: StudyTask[], targetMinutes: number): DayPlan {
  const dayTasks = tasks
    .filter((task) => task.date === date)
    .sort(
      (a, b) =>
        a.subject.localeCompare(b.subject) ||
        Number(a.status === 'completed') - Number(b.status === 'completed') ||
        a.title.localeCompare(b.title),
    );
  const stats = taskStats(dayTasks);
  const completedMinutes = sum(
    dayTasks.filter((task) => task.status === 'completed').map((task) => task.actualMinutes || task.plannedMinutes),
  );
  return {
    date,
    tasks: dayTasks,
    plannedMinutes: stats.plannedMinutes,
    completedMinutes,
    remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
    targetMinutes,
    stats,
  };
}

/* -------------------------------- topics ------------------------------ */

/** Maps a headline dashboard subject onto the topic categories that feed it. */
const SUBJECT_CATEGORY_MAP: Record<string, string[]> = {
  DevOps: [
    'Linux',
    'Networking',
    'Git',
    'GitHub',
    'Docker',
    'Docker Compose',
    'Docker Swarm',
    'Kubernetes',
    'Jenkins',
    'GitHub Actions',
    'CI/CD',
    'Terraform',
    'Ansible',
    'Monitoring',
    'Prometheus',
    'Grafana',
  ],
  AWS: ['AWS'],
  Docker: ['Docker', 'Docker Compose', 'Docker Swarm'],
  Kubernetes: ['Kubernetes'],
  Terraform: ['Terraform'],
  'CI/CD': ['Jenkins', 'GitHub Actions', 'CI/CD'],
  Monitoring: ['Monitoring', 'Prometheus', 'Grafana'],
  Java: ['Java', 'Spring Boot'],
};

export function categoriesForSubject(subject: string): string[] {
  return SUBJECT_CATEGORY_MAP[subject] ?? [subject];
}

export function topicsForSubject(topics: Topic[], subject: string): Topic[] {
  const categories = new Set(categoriesForSubject(subject));
  return topics.filter((topic) => categories.has(topic.category));
}

export function subjectProgress(topics: Topic[], subjects: readonly string[]): SubjectProgress[] {
  return subjects.map((subject) => {
    const matching = topicsForSubject(topics, subject);
    if (!matching.length) return { subject, progress: 0, completed: 0, total: 0 };
    const completed = matching.filter((topic) => topic.status === 'completed').length;
    const average = Math.round(sum(matching.map((topic) => topic.progress)) / matching.length);
    return { subject, progress: average, completed, total: matching.length };
  });
}

export function categoryProgress(topics: Topic[]): SubjectProgress[] {
  const byCategory = new Map<string, Topic[]>();
  for (const topic of topics) {
    const list = byCategory.get(topic.category) ?? [];
    list.push(topic);
    byCategory.set(topic.category, list);
  }
  return Array.from(byCategory.entries())
    .map(([category, list]) => ({
      subject: category,
      progress: Math.round(sum(list.map((topic) => topic.progress)) / list.length),
      completed: list.filter((topic) => topic.status === 'completed').length,
      total: list.length,
    }))
    .sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject));
}

/* ------------------------------- overall ------------------------------ */

export interface OverallProgressInput {
  courses: Course[];
  topics: Topic[];
  projects: Project[];
}

/** Weighted blend of topic mastery (60%), course completion (25%) and projects (15%). */
export function overallProgress({ courses, topics, projects }: OverallProgressInput): number {
  const topicScore = topics.length
    ? sum(topics.map((topic) => topic.progress)) / topics.length
    : 0;
  const courseScore = courses.length
    ? sum(courses.map((course) => courseCounts(course).progress)) / courses.length
    : 0;
  const projectScore = projects.length
    ? sum(projects.map((project) => projectProgress(project))) / projects.length
    : 0;

  const weights = [
    { score: topicScore, weight: topics.length ? 0.6 : 0 },
    { score: courseScore, weight: courses.length ? 0.25 : 0 },
    { score: projectScore, weight: projects.length ? 0.15 : 0 },
  ];
  const totalWeight = sum(weights.map((entry) => entry.weight));
  if (!totalWeight) return 0;
  return Math.round(sum(weights.map((entry) => entry.score * entry.weight)) / totalWeight);
}

/* ------------------------------- revision ----------------------------- */

/** A topic needs revision when it is flagged, overdue, or self-rated low. */
export function needsRevision(topic: Topic, today: ISODate): boolean {
  if (topic.status === 'completed' && topic.confidence >= 4 && !topic.nextRevisionAt) return false;
  if (topic.status === 'need-revision') return true;
  if (topic.nextRevisionAt && topic.nextRevisionAt <= today) return true;
  if (topic.confidence <= 2 && topic.status !== 'not-started') return true;
  return false;
}

export function revisionUrgency(topic: Topic, today: ISODate): number {
  if (topic.status === 'need-revision') return 100;
  if (topic.nextRevisionAt) {
    const overdueDays = Math.max(0, Math.round((Date.parse(today) - Date.parse(topic.nextRevisionAt)) / 86_400_000));
    return 40 + overdueDays;
  }
  return topic.confidence <= 2 ? 30 : 0;
}

/** Spaced-repetition interval (days) based on confidence and revision history. */
export function nextRevisionInterval(confidence: number, revisionCount: number): number {
  const base = [1, 2, 4, 7, 14, 30];
  const multiplier = 1 + Math.min(revisionCount, 4) * 0.25;
  const index = Math.max(0, Math.min(base.length - 1, confidence));
  return Math.round(base[index] * multiplier);
}
