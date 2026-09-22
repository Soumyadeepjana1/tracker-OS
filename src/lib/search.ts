import type { AppState } from '@/store/store';
import type { Tone } from '@/components/ui/primitives';
import { formatDate } from './date';
import { courseCounts, projectProgress } from './progress';
import { stripMarkdown } from './markdown';
import { formatMinutes } from './utils';

/** Global search across every collection, used by the top bar and Ctrl+K palette. */

export type SearchResultType = 'task' | 'course' | 'topic' | 'project' | 'note' | 'session';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  route: string;
  tone: Tone;
  /** Sort weight — smaller is more relevant. */
  score: number;
}

export const SEARCH_TYPE_LABELS: Record<SearchResultType, string> = {
  topic: 'Topics',
  task: 'Tasks',
  course: 'Courses',
  project: 'Projects',
  note: 'Notes',
  session: 'Study sessions',
};

export const SEARCH_TYPE_ROUTES: Record<SearchResultType, string> = {
  topic: '/topics',
  task: '/planner',
  course: '/courses',
  project: '/projects',
  note: '/notes',
  session: '/planner',
};

export const SEARCH_TYPE_TONES: Record<SearchResultType, Tone> = {
  topic: 'info',
  task: 'brand',
  course: 'accent',
  project: 'warn',
  note: 'ok',
  session: 'neutral',
};

function scoreField(haystack: string, needle: string, weight: number): number {
  const lower = haystack.toLowerCase();
  if (!needle) return 0;
  if (lower === needle) return weight * 3;
  if (lower.startsWith(needle)) return weight * 2;
  const index = lower.indexOf(needle);
  if (index >= 0) return weight + Math.min(index, 40) / 40;
  return 0;
}

/** Splits text into matched/unmatched segments for inline highlighting. */
export function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
  const needle = query.trim();
  if (!needle) return [{ text, match: false }];

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const segments: { text: string; match: boolean }[] = [];

  let cursor = 0;
  while (cursor < text.length) {
    const found = lowerText.indexOf(lowerNeedle, cursor);
    if (found === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (found > cursor) segments.push({ text: text.slice(cursor, found), match: false });
    segments.push({ text: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
  }

  return segments.length ? segments : [{ text, match: false }];
}

/** Case-insensitive substring search ranked by where the match landed. */
export function searchAll(query: string, state: AppState, limit = 40): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return [];

  const results: SearchResult[] = [];

  for (const topic of state.topics) {
    const score =
      scoreField(topic.name, needle, 10) +
      scoreField(topic.category, needle, 4) +
      scoreField(topic.notes, needle, 1);
    if (score <= 0) continue;
    results.push({
      id: topic.id,
      type: 'topic',
      title: topic.name,
      subtitle: `${topic.category} · ${topic.progress}% · ${topic.status}`,
      route: `/topics?focus=${topic.id}`,
      tone: 'info',
      score: score + 1,
    });
  }

  for (const task of state.tasks) {
    const score =
      scoreField(task.title, needle, 10) +
      scoreField(task.subject, needle, 4) +
      scoreField(task.topic, needle, 4) +
      scoreField(task.notes, needle, 1);
    if (score <= 0) continue;
    results.push({
      id: task.id,
      type: 'task',
      title: task.title,
      subtitle: `${formatDate(task.date, 'short')} · ${task.subject} · ${formatMinutes(task.plannedMinutes)} · ${task.status}`,
      route: `/planner?date=${task.date}&focus=${task.id}`,
      tone: 'brand',
      score: score + 0.6,
    });
  }

  for (const course of state.courses) {
    const score =
      scoreField(course.name, needle, 10) +
      scoreField(course.instructor, needle, 4) +
      scoreField(course.platform, needle, 3) +
      scoreField(course.notes, needle, 1) +
      scoreField(course.modules.map((module) => `${module.title} ${module.lessons.map((lesson) => lesson.title).join(' ')}`).join(' '), needle, 3);
    if (score <= 0) continue;
    const counts = courseCounts(course);
    results.push({
      id: course.id,
      type: 'course',
      title: course.name,
      subtitle: `${course.platform || 'Self paced'} · ${counts.progress}% · ${counts.completedModules}/${counts.totalModules} modules`,
      route: `/courses?focus=${course.id}`,
      tone: 'accent',
      score: score + 0.8,
    });
  }

  for (const project of state.projects) {
    const score =
      scoreField(project.name, needle, 10) +
      scoreField(project.description, needle, 4) +
      scoreField(project.technologies.join(' '), needle, 4) +
      scoreField(project.tasks.map((task) => task.title).join(' '), needle, 3) +
      scoreField(project.notes, needle, 1);
    if (score <= 0) continue;
    results.push({
      id: project.id,
      type: 'project',
      title: project.name,
      subtitle: `${projectProgress(project)}% · ${project.technologies.slice(0, 3).join(', ') || 'no tech listed'}`,
      route: `/projects?focus=${project.id}`,
      tone: 'warn',
      score: score + 0.9,
    });
  }

  for (const note of state.notes) {
    const score =
      scoreField(note.title, needle, 10) +
      scoreField(note.topic, needle, 5) +
      scoreField(note.tags.join(' '), needle, 4) +
      scoreField(note.content, needle, 2);
    if (score <= 0) continue;
    results.push({
      id: note.id,
      type: 'note',
      title: note.title,
      subtitle: `${note.topic || 'unfiled'} · ${stripMarkdown(note.content, 70) || 'empty note'}`,
      route: `/notes?focus=${note.id}`,
      tone: 'ok',
      score: score + 0.7,
    });
  }

  for (const session of state.sessions) {
    const score = scoreField(session.topic, needle, 8) + scoreField(session.subject, needle, 4) + scoreField(session.notes, needle, 1);
    if (score <= 0) continue;
    results.push({
      id: session.id,
      type: 'session',
      title: session.topic || session.subject,
      subtitle: `${formatDate(session.date, 'short')} · ${formatMinutes(session.minutes)} of ${session.subject}`,
      route: `/planner?date=${session.date}`,
      tone: 'neutral',
      score: score + 1.4,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export interface ResultGroup {
  type: SearchResultType;
  label: string;
  items: SearchResult[];
}

export function groupResults(results: SearchResult[]): ResultGroup[] {
  const order: SearchResultType[] = ['topic', 'task', 'course', 'project', 'note', 'session'];
  return order
    .map((type) => ({
      type,
      label: SEARCH_TYPE_LABELS[type],
      items: results.filter((result) => result.type === type),
    }))
    .filter((group) => group.items.length > 0);
}
