import type {
  BackupPayload,
  Confidence,
  Course,
  CourseModule,
  CourseStatus,
  Difficulty,
  ISODate,
  Lesson,
  LessonStatus,
  Note,
  Priority,
  Project,
  ProjectStatus,
  ProjectTask,
  RevisionRecord,
  Settings,
  StudySession,
  StudyTask,
  TaskStatus,
  TimerMode,
  Topic,
  TopicStatus,
} from '@/types';
import { COURSE_STATUS_META, PRIORITIES, TASK_STATUSES, TOPIC_STATUSES } from '@/types';
import { addDays, formatDate, todayISO } from './date';
import { courseCounts, projectProgress, taskStats } from './progress';
import { stripMarkdown } from './markdown';
import { clamp, formatMinutes, sum, uid } from './utils';
import { DEFAULT_SETTINGS, mergeSettings } from '@/store/defaults';

export const BACKUP_VERSION = 1;
export const BACKUP_APP_ID = 'devops-learning-os';
export const BACKUP_FILENAME = 'devops-learning-os-backup.json';

export interface BackupSource {
  courses: Course[];
  topics: Topic[];
  tasks: StudyTask[];
  projects: Project[];
  notes: Note[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  settings: Settings;
}

export function buildBackup(source: BackupSource): BackupPayload {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    courses: source.courses,
    topics: source.topics,
    tasks: source.tasks,
    projects: source.projects,
    notes: source.notes,
    sessions: source.sessions,
    revisions: source.revisions,
    settings: source.settings,
    meta: {
      counts: {
        courses: source.courses.length,
        topics: source.topics.length,
        tasks: source.tasks.length,
        projects: source.projects.length,
        notes: source.notes.length,
        sessions: source.sessions.length,
        revisions: source.revisions.length,
      },
    },
  };
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/* --------------------------- defensive coercion ------------------------ */

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asBool = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function asConfidence(value: unknown, fallback: Confidence = 3): Confidence {
  const numeric = Math.round(clamp(asNumber(value, fallback), 1, 5));
  return clamp(numeric, 1, 5) as Confidence;
}

function asIsoDate(value: unknown, fallback: ISODate): ISODate {
  const text = asString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function asId(value: unknown, prefix: string): string {
  const text = asString(value);
  return text.trim() ? text : uid(prefix);
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

/* ------------------------------- normalizers --------------------------- */

function normalizeLesson(raw: unknown): Lesson {
  const record = asRecord(raw);
  return {
    id: asId(record.id, 'lsn'),
    title: asString(record.title, 'Untitled lesson'),
    durationMinutes: Math.max(0, asNumber(record.durationMinutes, 30)),
    status: asEnum<LessonStatus>(record.status, ['not-started', 'in-progress', 'completed'], 'not-started'),
    notes: asString(record.notes),
    needsRevision: asBool(record.needsRevision),
  };
}

function normalizeModule(raw: unknown): CourseModule {
  const record = asRecord(raw);
  return {
    id: asId(record.id, 'mod'),
    title: asString(record.title, 'Untitled module'),
    lessons: asArray(record.lessons).map(normalizeLesson),
  };
}

export function normalizeCourse(raw: unknown): Course {
  const record = asRecord(raw);
  const timestamp = new Date().toISOString();
  return {
    id: asId(record.id, 'crs'),
    name: asString(record.name, 'Untitled course'),
    instructor: asString(record.instructor),
    platform: asString(record.platform),
    url: asString(record.url),
    category: asString(record.category, 'DevOps'),
    totalModules: Math.max(0, asNumber(record.totalModules, 0)),
    completedModules: Math.max(0, asNumber(record.completedModules, 0)),
    status: asEnum<CourseStatus>(record.status, COURSE_STATUS_META.map((meta) => meta.value), 'not-started'),
    modules: asArray(record.modules).map(normalizeModule),
    notes: asString(record.notes),
    createdAt: asString(record.createdAt, timestamp),
    updatedAt: asString(record.updatedAt, timestamp),
  };
}

export function normalizeTopic(raw: unknown): Topic {
  const record = asRecord(raw);
  const timestamp = new Date().toISOString();
  const nextRevisionAt = asString(record.nextRevisionAt);
  const lastStudiedAt = asString(record.lastStudiedAt);
  return {
    id: asId(record.id, 'tpc'),
    name: asString(record.name, 'Untitled topic'),
    category: asString(record.category, 'DevOps'),
    status: asEnum<TopicStatus>(record.status, TOPIC_STATUSES, 'not-started'),
    progress: clamp(Math.round(asNumber(record.progress, 0)), 0, 100),
    confidence: asConfidence(record.confidence),
    difficulty: asEnum<Difficulty>(record.difficulty, ['easy', 'medium', 'hard'], 'medium'),
    lastStudiedAt: /^\d{4}-\d{2}-\d{2}$/.test(lastStudiedAt) ? lastStudiedAt : undefined,
    nextRevisionAt: /^\d{4}-\d{2}-\d{2}$/.test(nextRevisionAt) ? nextRevisionAt : undefined,
    revisionCount: Math.max(0, Math.round(asNumber(record.revisionCount, 0))),
    resourceUrl: asString(record.resourceUrl),
    notes: asString(record.notes),
    createdAt: asString(record.createdAt, timestamp),
    updatedAt: asString(record.updatedAt, timestamp),
  };
}

export function normalizeTask(raw: unknown): StudyTask {
  const record = asRecord(raw);
  const timestamp = new Date().toISOString();
  const status = asEnum<TaskStatus>(record.status, TASK_STATUSES, 'pending');
  return {
    id: asId(record.id, 'tsk'),
    date: asIsoDate(record.date, todayISO()),
    subject: asString(record.subject, 'DevOps'),
    topic: asString(record.topic),
    title: asString(record.title, 'Untitled task'),
    plannedMinutes: Math.max(0, asNumber(record.plannedMinutes, 30)),
    actualMinutes: Math.max(0, asNumber(record.actualMinutes, status === 'completed' ? asNumber(record.plannedMinutes, 30) : 0)),
    priority: asEnum<Priority>(record.priority, PRIORITIES, 'medium'),
    status,
    notes: asString(record.notes),
    completedAt: asString(record.completedAt) || undefined,
    createdAt: asString(record.createdAt, timestamp),
    updatedAt: asString(record.updatedAt, timestamp),
  };
}

function normalizeProjectTask(raw: unknown): ProjectTask {
  const record = asRecord(raw);
  return {
    id: asId(record.id, 'ptk'),
    title: asString(record.title, 'Untitled task'),
    done: asBool(record.done),
  };
}

export function normalizeProject(raw: unknown): Project {
  const record = asRecord(raw);
  const timestamp = new Date().toISOString();
  const today = todayISO();
  return {
    id: asId(record.id, 'prj'),
    name: asString(record.name, 'Untitled project'),
    description: asString(record.description),
    technologies: asStringArray(record.technologies),
    repoUrl: asString(record.repoUrl),
    startDate: asIsoDate(record.startDate, today),
    targetDate: asIsoDate(record.targetDate, addDays(today, 30)),
    status: asEnum<ProjectStatus>(record.status, ['planned', 'in-progress', 'completed', 'on-hold'], 'planned'),
    tasks: asArray(record.tasks).map(normalizeProjectTask),
    notes: asString(record.notes),
    createdAt: asString(record.createdAt, timestamp),
    updatedAt: asString(record.updatedAt, timestamp),
  };
}

export function normalizeNote(raw: unknown): Note {
  const record = asRecord(raw);
  const timestamp = new Date().toISOString();
  return {
    id: asId(record.id, 'nte'),
    title: asString(record.title, 'Untitled note'),
    topic: asString(record.topic),
    tags: asStringArray(record.tags),
    content: asString(record.content),
    pinned: asBool(record.pinned),
    archived: asBool(record.archived),
    createdAt: asString(record.createdAt, timestamp),
    updatedAt: asString(record.updatedAt, timestamp),
  };
}

export function normalizeSession(raw: unknown): StudySession {
  const record = asRecord(raw);
  const date = asIsoDate(record.date, todayISO());
  return {
    id: asId(record.id, 'ses'),
    date,
    startedAt: asString(record.startedAt, `${date}T00:00:00.000Z`),
    minutes: Math.max(0, Math.round(asNumber(record.minutes, 0))),
    subject: asString(record.subject, 'DevOps'),
    topic: asString(record.topic),
    notes: asString(record.notes),
    mode: asEnum<TimerMode>(record.mode, ['pomodoro-25', 'pomodoro-50', 'custom'], 'custom'),
  };
}

export function normalizeRevision(raw: unknown): RevisionRecord {
  const record = asRecord(raw);
  const topicName = asString(record.topicName, 'Unknown topic');
  return {
    id: asId(record.id, 'rev'),
    topicId: asString(record.topicId) || null,
    topicName,
    date: asIsoDate(record.date, todayISO()),
    confidence: asConfidence(record.confidence),
    minutes: Math.max(0, Math.round(asNumber(record.minutes, 0))),
    notes: asString(record.notes),
  };
}

export type ImportResult =
  | { ok: true; payload: Required<Omit<BackupPayload, 'meta'>> & { meta?: Record<string, unknown> } }
  | { ok: false; error: string };

/**
 * Validates and repairs an imported backup. Unknown shapes are rejected with a
 * human-readable reason; partially damaged records are repaired field by field
 * so one bad note never destroys the whole restore.
 */
export function parseBackup(text: string): ImportResult {
  if (!text.trim()) return { ok: false, error: 'The selected file is empty.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: `That file is not valid JSON${error instanceof Error ? ` (${error.message})` : ''}.`,
    };
  }

  const record = asRecord(parsed);
  if (!Object.keys(record).length) return { ok: false, error: 'The file does not contain an object.' };

  const hasAnyCollection = ['courses', 'topics', 'tasks', 'projects', 'notes', 'sessions', 'revisions'].some(
    (key) => Array.isArray(record[key]),
  );
  if (!hasAnyCollection) {
    return {
      ok: false,
      error: 'This does not look like a DevOps Learning OS backup — no known collections were found.',
    };
  }

  const settings = mergeSettings(DEFAULT_SETTINGS, asRecord(record.settings) as Partial<Settings>);

  return {
    ok: true,
    payload: {
      app: BACKUP_APP_ID,
      version: asNumber(record.version, BACKUP_VERSION),
      exportedAt: asString(record.exportedAt, new Date().toISOString()),
      courses: asArray(record.courses).map(normalizeCourse),
      topics: asArray(record.topics).map(normalizeTopic),
      tasks: asArray(record.tasks).map(normalizeTask),
      projects: asArray(record.projects).map(normalizeProject),
      notes: asArray(record.notes).map(normalizeNote),
      sessions: asArray(record.sessions).map(normalizeSession),
      revisions: asArray(record.revisions).map(normalizeRevision),
      settings,
      meta: asRecord(record.meta),
    },
  };
}

/* ------------------------- markdown / GitHub backup -------------------- */

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

export function notesToMarkdown(notes: Note[]): string {
  if (!notes.length) return '# Notes\n\n_No notes yet._\n';
  const sorted = [...notes].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
  return [
    '# DevOps Learning OS — Notes',
    '',
    `_Exported ${new Date().toISOString()} · ${notes.length} note(s)_`,
    '',
    ...sorted.map((note) =>
      [
        `## ${note.pinned ? '📌 ' : ''}${note.title}`,
        '',
        `- **Topic:** ${note.topic || '—'}`,
        `- **Tags:** ${note.tags.length ? note.tags.map((tag) => `\`${tag}\``).join(', ') : '—'}`,
        `- **Updated:** ${note.updatedAt}`,
        `- **Archived:** ${note.archived ? 'yes' : 'no'}`,
        '',
        note.content,
        '',
        '---',
        '',
      ].join('\n'),
    ),
  ].join('\n');
}

export function studyPlanToMarkdown(tasks: StudyTask[], from: ISODate, to: ISODate): string {
  const inRange = tasks
    .filter((task) => task.date >= from && task.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject));
  const days = Array.from(new Set(inRange.map((task) => task.date)));

  return [
    '# DevOps Learning OS — Study Plan',
    '',
    `_${formatDate(from)} → ${formatDate(to)}_`,
    '',
    ...days.flatMap((date) => {
      const dayTasks = inRange.filter((task) => task.date === date);
      const stats = taskStats(dayTasks);
      return [
        `## ${formatDate(date, 'long')}`,
        '',
        `Target: ${formatMinutes(stats.plannedMinutes)} · Completed: ${formatMinutes(stats.actualMinutes)} · Tasks: ${stats.completed}/${stats.total}`,
        '',
        ...dayTasks.map(
          (task) =>
            `- [${task.status === 'completed' ? 'x' : ' '}] **${task.subject}** — ${task.title} (${formatMinutes(task.plannedMinutes)}, ${task.priority}, ${task.status})`,
        ),
        '',
      ];
    }),
  ].join('\n');
}

export function progressToMarkdown(source: BackupSource): string {
  const lines: string[] = [
    '# DevOps Learning OS — Progress',
    '',
    `_Generated ${new Date().toISOString()}_`,
    '',
    '## Courses',
    '',
    '| Course | Platform | Modules | Progress | Status |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const course of source.courses) {
    const counts = courseCounts(course);
    lines.push(
      `| ${course.name} | ${course.platform || '—'} | ${counts.completedModules}/${counts.totalModules} | ${counts.progress}% | ${course.status} |`,
    );
  }

  lines.push('', '## Projects', '', '| Project | Progress | Tasks | Status |', '| --- | --- | --- | --- |');
  for (const project of source.projects) {
    const done = project.tasks.filter((task) => task.done).length;
    lines.push(`| ${project.name} | ${projectProgress(project)}% | ${done}/${project.tasks.length} | ${project.status} |`);
  }

  lines.push('', '## Topics needing revision', '');
  const today = todayISO();
  const revision = source.topics.filter(
    (topic) => topic.status === 'need-revision' || (topic.nextRevisionAt && topic.nextRevisionAt <= today),
  );
  lines.push(...(revision.length ? revision.map((topic) => `- ${topic.name} (${topic.category}) — confidence ${topic.confidence}/5`) : ['_Nothing flagged._']));

  lines.push('', '## Study time', '');
  const totalMinutes = sum(source.sessions.map((session) => session.minutes));
  lines.push(`- Total logged: **${formatMinutes(totalMinutes)}** across ${source.sessions.length} sessions`);
  lines.push(`- Tasks completed: **${source.tasks.filter((task) => task.status === 'completed').length}**`);

  return lines.join('\n');
}

/** Files to commit under `data/` for the manual GitHub backup workflow. */
export function generateGitHubBackupFiles(source: BackupSource): GeneratedFile[] {
  const stamp = new Date().toISOString();
  const files: GeneratedFile[] = [
    {
      path: 'data/courses.json',
      content: JSON.stringify(source.courses, null, 2),
      description: `${source.courses.length} courses`,
    },
    {
      path: 'data/topics.json',
      content: JSON.stringify(source.topics, null, 2),
      description: `${source.topics.length} topics`,
    },
    {
      path: 'data/tasks.json',
      content: JSON.stringify(source.tasks, null, 2),
      description: `${source.tasks.length} tasks`,
    },
    {
      path: 'data/projects.json',
      content: JSON.stringify(source.projects, null, 2),
      description: `${source.projects.length} projects`,
    },
    {
      path: 'data/study-sessions.json',
      content: JSON.stringify(source.sessions, null, 2),
      description: `${source.sessions.length} sessions`,
    },
    {
      path: 'data/revisions.json',
      content: JSON.stringify(source.revisions, null, 2),
      description: `${source.revisions.length} revision records`,
    },
    {
      path: 'data/settings.json',
      content: JSON.stringify(sanitizeSettings(source.settings), null, 2),
      description: 'settings (API key stripped)',
    },
    {
      path: 'data/progress.md',
      content: progressToMarkdown(source),
      description: 'human-readable progress report',
    },
    {
      path: 'data/notes/README.md',
      content: notesToMarkdown(source.notes),
      description: 'all notes as markdown',
    },
  ];

  source.notes.forEach((note, index) => {
    files.push({
      path: `data/notes/${String(index + 1).padStart(2, '0')}-${slugify(note.title)}.md`,
      content: [
        '---',
        `title: ${JSON.stringify(note.title)}`,
        `topic: ${JSON.stringify(note.topic)}`,
        `tags: [${note.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`,
        `created: ${note.createdAt}`,
        `updated: ${note.updatedAt}`,
        `pinned: ${note.pinned}`,
        `archived: ${note.archived}`,
        '---',
        '',
        note.content,
        '',
      ].join('\n'),
      description: stripMarkdown(note.content, 60),
    });
  });

  files.push({
    path: 'data/README.md',
    content: [
      '# Backup data',
      '',
      `Generated by DevOps Learning OS on ${stamp}.`,
      '',
      'These files are safe to commit: they contain **no secrets or API keys**',
      '(the AI API key is stripped and never leaves your browser).',
      '',
      '| File | Contents |',
      '| --- | --- |',
      ...files.map((file) => `| \`${file.path}\` | ${file.description} |`),
      '',
      'To restore this state in the app, use **Settings → Data → Import** with a full',
      '`devops-learning-os-backup.json` export (the granular files above are for',
      'version control and human reading).',
      '',
    ].join('\n'),
    description: 'index of the backup contents',
  });

  return files;
}

/** Removes the API key (and any future secret fields) before writing to disk. */
export function sanitizeSettings(settings: Settings): Settings {
  return {
    ...settings,
    ai: { ...settings.ai, apiKey: '' },
  };
}

/* ------------------------------ import helpers ------------------------ */

export function importCounts(payload: BackupPayload): string {
  return [
    `${payload.courses.length} courses`,
    `${payload.topics.length} topics`,
    `${payload.tasks.length} tasks`,
    `${payload.projects.length} projects`,
    `${payload.notes.length} notes`,
    `${payload.sessions.length} sessions`,
    `${payload.revisions.length} revisions`,
  ].join(' · ');
}
