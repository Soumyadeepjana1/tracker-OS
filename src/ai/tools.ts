import type { Confidence, Priority, TopicStatus } from '@/types';
import type { AppState } from '@/store/store';
import { store } from '@/store/store';
import type { Analytics } from '@/lib/analytics';
import { addDays, todayISO } from '@/lib/date';
import { courseCounts, projectProgress } from '@/lib/progress';
import { formatMinutes, truncate, uid } from '@/lib/utils';

/**
 * The assistant's tool surface.
 *
 * Design rules (see section 17 of the brief):
 *  - `read` tools are safe and run automatically.
 *  - `write` tools only run **after** the user confirms them in the UI.
 *  - `destructive` tools are visually highlighted and always require a click.
 *  - There is no filesystem, network, shell or eval capability anywhere here.
 *
 * The model never touches the browser directly — it can only *ask* for one of
 * the tools below, with JSON arguments that this module validates.
 */

export type ToolKind = 'read' | 'write' | 'destructive';

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  kind: ToolKind;
  params: ToolParam[];
  run: (args: ToolArgs, state: AppState, analytics: Analytics) => string | Promise<string>;
}

export type ToolArgs = Record<string, unknown>;

/* ----------------------------- arg coercion ---------------------------- */

export function argString(args: ToolArgs, key: string, fallback = ''): string {
  const value = args[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

export function argNumber(args: ToolArgs, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function argStringArray(args: ToolArgs, key: string): string[] {
  const value = args[key];
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchByName<T>(items: T[], nameOf: (item: T) => string, query: string): T | undefined {
  const needle = normalize(query);
  if (!needle) return undefined;
  return (
    items.find((item) => normalize(nameOf(item)) === needle) ??
    items.find((item) => normalize(nameOf(item)).includes(needle)) ??
    items.find((item) => needle.includes(normalize(nameOf(item))))
  );
}

const PRIORITY_VALUES: Priority[] = ['low', 'medium', 'high', 'critical'];
const TOPIC_STATUS_VALUES: TopicStatus[] = ['not-started', 'learning', 'practiced', 'completed', 'need-revision'];

/* -------------------------------- tools -------------------------------- */

export const TOOLS: ToolDefinition[] = [
  /* ------------------------------ read ------------------------------- */
  {
    name: 'getProgress',
    kind: 'read',
    description: 'Overall learning progress, study minutes, streaks and per-subject completion.',
    params: [],
    run: (_args, _state, analytics) => {
      const subjects = analytics.subjectProgress
        .map((entry) => `${entry.subject}: ${entry.progress}% (${entry.completed}/${entry.total} topics complete)`)
        .join('\n');
      return [
        `Overall: ${analytics.overall}%`,
        `Today: ${formatMinutes(analytics.minutesToday)} / target ${formatMinutes(analytics.targetToday)} (${analytics.todayProgress}%)`,
        `This week: ${formatMinutes(analytics.minutesThisWeek)} / ${formatMinutes(analytics.weekTarget)} (${analytics.weekProgress}%)`,
        `Total logged: ${formatMinutes(analytics.minutesTotal)}`,
        `Streak: ${analytics.streak.current} day(s), longest ${analytics.streak.longest}`,
        `Consistency (28d): ${analytics.consistency}%`,
        `Courses average: ${analytics.courseProgressAverage}% · Projects average: ${analytics.projectProgressAverage}%`,
        '',
        'Subject breakdown:',
        subjects,
      ].join('\n');
    },
  },
  {
    name: 'getTodayTasks',
    kind: 'read',
    description: 'Tasks planned for today with status, priority and duration.',
    params: [],
    run: (_args, _state, analytics) => {
      if (!analytics.today.tasks.length) return 'No tasks are planned for today.';
      return [
        `Target: ${formatMinutes(analytics.today.targetMinutes)} · Done: ${formatMinutes(analytics.today.completedMinutes)} · Remaining: ${formatMinutes(analytics.today.remainingMinutes)}`,
        ...analytics.today.tasks.map(
          (task) =>
            `- [${task.status}] ${task.subject} — ${task.title} · ${formatMinutes(task.plannedMinutes)} · ${task.priority} (id: ${task.id})`,
        ),
      ].join('\n');
    },
  },
  {
    name: 'getCourseStatus',
    kind: 'read',
    description: 'Status of every course: progress percent, modules completed and remaining.',
    params: [{ name: 'courseName', type: 'string', description: 'Optional course name filter' }],
    run: (args, state) => {
      const query = argString(args, 'courseName');
      const courses = query
        ? state.courses.filter((course) => normalize(course.name).includes(normalize(query)))
        : state.courses;
      if (!courses.length) return query ? `No course matched "${query}".` : 'No courses yet.';
      return courses
        .map((course) => {
          const counts = courseCounts(course);
          return `- ${course.name} (${course.platform || 'n/a'}) — ${counts.progress}% · ${counts.completedModules}/${counts.totalModules} modules · ${counts.remainingModules} remaining · ${course.status}`;
        })
        .join('\n');
    },
  },
  {
    name: 'getTopicStatus',
    kind: 'read',
    description: 'Topic mastery by category, including weak areas and confidence.',
    params: [
      { name: 'category', type: 'string', description: 'Optional category filter, e.g. Kubernetes' },
    ],
    run: (args, state) => {
      const category = argString(args, 'category');
      const topics = category
        ? state.topics.filter((topic) => normalize(topic.category).includes(normalize(category)))
        : state.topics;
      if (!topics.length) return 'No matching topics.';
      return topics
        .map(
          (topic) =>
            `- ${topic.name} [${topic.category}] — ${topic.progress}% · ${topic.status} · confidence ${topic.confidence}/5 · ${topic.difficulty}`,
        )
        .join('\n');
    },
  },
  {
    name: 'getRevisionQueue',
    kind: 'read',
    description: 'Topics that need revision now, ordered by urgency.',
    params: [],
    run: (_args, _state, analytics) => {
      if (!analytics.revisionTopics.length) return 'Nothing is due for revision right now.';
      return analytics.revisionTopics
        .slice(0, 15)
        .map(
          (topic) =>
            `- ${topic.name} [${topic.category}] — confidence ${topic.confidence}/5 · last studied ${topic.lastStudiedAt ?? 'never'} · next ${topic.nextRevisionAt ?? 'unscheduled'}`,
        )
        .join('\n');
    },
  },
  {
    name: 'searchNotes',
    kind: 'read',
    description: 'Full-text search across your notes. Returns ids and matching titles.',
    params: [{ name: 'query', type: 'string', description: 'Search text', required: true }],
    run: (args, state) => {
      const query = normalize(argString(args, 'query'));
      if (!query) return 'Provide a search query.';
      const matches = state.notes.filter((note) =>
        [note.title, note.topic, note.content, note.tags.join(' ')].some((field) =>
          normalize(field).includes(query),
        ),
      );
      if (!matches.length) return `No notes matched "${query}".`;
      return matches
        .slice(0, 12)
        .map((note) => `- ${note.title} (id: ${note.id}) · topic: ${note.topic || '—'} · tags: ${note.tags.join(', ') || '—'}`)
        .join('\n');
    },
  },
  {
    name: 'getGitHubRepositories',
    kind: 'read',
    description: 'Public GitHub repositories currently loaded, with language and stars.',
    params: [],
    run: (_args, state) => {
      const { repositories, username } = state.github;
      if (!repositories.length) {
        return username
          ? `No repository data cached for @${username}. Use Refresh on the GitHub page.`
          : 'No GitHub username configured.';
      }
      return repositories
        .slice(0, 15)
        .map(
          (repo) =>
            `- ${repo.name} (${repo.language}, ★${repo.stars}) — ${truncate(repo.description || 'no description', 70)} · updated ${repo.updatedAt.slice(0, 10)}`,
        )
        .join('\n');
    },
  },
  {
    name: 'getProjects',
    kind: 'read',
    description: 'Projects with completion percentage and outstanding tasks.',
    params: [],
    run: (_args, state) => {
      if (!state.projects.length) return 'No projects yet.';
      return state.projects
        .map((project) => {
          const open = project.tasks.filter((task) => !task.done).map((task) => task.title);
          return `- ${project.name} — ${projectProgress(project)}% · ${project.status} · target ${project.targetDate}${
            open.length ? ` · open: ${open.slice(0, 4).join('; ')}` : ' · all tasks done'
          }`;
        })
        .join('\n');
    },
  },
  {
    name: 'getStudyStats',
    kind: 'read',
    description: 'Study minutes for recent days, weeks and months.',
    params: [{ name: 'days', type: 'number', description: 'How many recent days to include (default 7)' }],
    run: (args, _state, analytics) => {
      const days = Math.max(1, Math.min(60, Math.round(argNumber(args, 'days', 7))));
      const entries = Object.entries(analytics.studyMinutesByDay)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, days);
      if (!entries.length) return 'No study sessions logged yet.';
      return entries.map(([date, minutes]) => `${date}: ${formatMinutes(minutes)}`).join('\n');
    },
  },

  /* ------------------------------ write ------------------------------ */
  {
    name: 'createTask',
    kind: 'write',
    description: 'Create a study task on a given day.',
    params: [
      { name: 'title', type: 'string', description: 'Task title', required: true },
      { name: 'date', type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
      { name: 'subject', type: 'string', description: 'e.g. DevOps, Java', required: true },
      { name: 'topic', type: 'string', description: 'Topic name' },
      { name: 'plannedMinutes', type: 'number', description: 'Planned duration in minutes' },
      { name: 'priority', type: 'string', description: 'low | medium | high | critical' },
      { name: 'notes', type: 'string', description: 'Optional notes' },
    ],
    run: async (args) => {
      const title = argString(args, 'title');
      if (!title) throw new Error('createTask requires a title');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(argString(args, 'date')) ? argString(args, 'date') : todayISO();
      const task = await store.addTask({
        title,
        date,
        subject: argString(args, 'subject', 'DevOps'),
        topic: argString(args, 'topic', argString(args, 'subject', 'DevOps')),
        plannedMinutes: Math.max(5, Math.round(argNumber(args, 'plannedMinutes', 60))),
        priority: PRIORITY_VALUES.includes(argString(args, 'priority') as Priority)
          ? (argString(args, 'priority') as Priority)
          : 'medium',
        notes: argString(args, 'notes'),
      });
      return `Created task "${task.title}" on ${task.date} (id: ${task.id}).`;
    },
  },
  {
    name: 'completeTask',
    kind: 'write',
    description: 'Mark an existing task as completed.',
    params: [{ name: 'title', type: 'string', description: 'Task title (fuzzy match)', required: true }],
    run: async (args, state) => {
      const query = argString(args, 'title');
      const task = matchByName(state.tasks, (item) => item.title, query);
      if (!task) throw new Error(`No task matched "${query}"`);
      await store.updateTask(task.id, { status: 'completed' });
      return `Marked "${task.title}" as completed.`;
    },
  },
  {
    name: 'createNote',
    kind: 'write',
    description: 'Create a markdown note.',
    params: [
      { name: 'title', type: 'string', description: 'Note title', required: true },
      { name: 'topic', type: 'string', description: 'Related topic' },
      { name: 'tags', type: 'string', description: 'Comma separated tags' },
      { name: 'content', type: 'string', description: 'Markdown body', required: true },
    ],
    run: async (args) => {
      const title = argString(args, 'title');
      const content = argString(args, 'content');
      if (!title) throw new Error('createNote requires a title');
      const note = await store.addNote({
        title,
        topic: argString(args, 'topic'),
        tags: argStringArray(args, 'tags'),
        content,
      });
      return `Created note "${note.title}" (id: ${note.id}).`;
    },
  },
  {
    name: 'updateNote',
    kind: 'write',
    description: 'Append content to, or retitle, an existing note.',
    params: [
      { name: 'title', type: 'string', description: 'Existing note title (fuzzy match)', required: true },
      { name: 'appendContent', type: 'string', description: 'Markdown to append' },
      { name: 'newTitle', type: 'string', description: 'Rename the note' },
      { name: 'addTags', type: 'string', description: 'Comma separated tags to add' },
    ],
    run: async (args, state) => {
      const query = argString(args, 'title');
      const note = matchByName(state.notes, (item) => item.title, query);
      if (!note) throw new Error(`No note matched "${query}"`);
      const append = argString(args, 'appendContent');
      const newTitle = argString(args, 'newTitle');
      const addTags = argStringArray(args, 'addTags');
      await store.updateNote(note.id, {
        title: newTitle || note.title,
        content: append ? `${note.content}\n\n${append}` : note.content,
        tags: addTags.length ? Array.from(new Set([...note.tags, ...addTags])) : note.tags,
      });
      return `Updated note "${newTitle || note.title}".`;
    },
  },
  {
    name: 'updateProgress',
    kind: 'write',
    description: 'Update a topic’s mastery percentage, status or confidence.',
    params: [
      { name: 'topic', type: 'string', description: 'Topic name (fuzzy match)', required: true },
      { name: 'progress', type: 'number', description: '0-100' },
      { name: 'status', type: 'string', description: 'not-started | learning | practiced | completed | need-revision' },
      { name: 'confidence', type: 'number', description: '1-5' },
    ],
    run: async (args, state) => {
      const query = argString(args, 'topic');
      const topic = matchByName(state.topics, (item) => item.name, query);
      if (!topic) throw new Error(`No topic matched "${query}"`);
      const status = argString(args, 'status') as TopicStatus;
      const progressValue = args.progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(argNumber(args, 'progress', topic.progress))));
      const confidenceValue =
        args.confidence === undefined
          ? undefined
          : (Math.max(1, Math.min(5, Math.round(argNumber(args, 'confidence', topic.confidence)))) as Confidence);

      await store.updateTopic(topic.id, {
        progress: progressValue,
        confidence: confidenceValue,
        status: TOPIC_STATUS_VALUES.includes(status) ? status : undefined,
        lastStudiedAt: todayISO(),
      });
      return `Updated "${topic.name}" — ${progressValue ?? topic.progress}% · ${status || topic.status} · confidence ${confidenceValue ?? topic.confidence}/5.`;
    },
  },
  {
    name: 'createProject',
    kind: 'write',
    description: 'Create a project with an initial task checklist.',
    params: [
      { name: 'name', type: 'string', description: 'Project name', required: true },
      { name: 'description', type: 'string', description: 'What it does' },
      { name: 'technologies', type: 'string', description: 'Comma separated tech' },
      { name: 'targetDate', type: 'string', description: 'YYYY-MM-DD' },
      { name: 'tasks', type: 'string', description: 'Comma separated task titles' },
    ],
    run: async (args) => {
      const name = argString(args, 'name');
      if (!name) throw new Error('createProject requires a name');
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(argString(args, 'targetDate'))
        ? argString(args, 'targetDate')
        : addDays(todayISO(), 30);
      const project = await store.addProject({
        name,
        description: argString(args, 'description'),
        technologies: argStringArray(args, 'technologies'),
        targetDate,
        status: 'planned',
        tasks: argStringArray(args, 'tasks').map((title) => ({ id: uid('ptk'), title, done: false })),
      });
      return `Created project "${project.name}" with ${project.tasks.length} task(s).`;
    },
  },
  {
    name: 'addProjectTask',
    kind: 'write',
    description: 'Add a checklist item to an existing project.',
    params: [
      { name: 'project', type: 'string', description: 'Project name (fuzzy match)', required: true },
      { name: 'title', type: 'string', description: 'Task title', required: true },
    ],
    run: async (args, state) => {
      const project = matchByName(state.projects, (item) => item.name, argString(args, 'project'));
      const title = argString(args, 'title');
      if (!project) throw new Error(`No project matched "${argString(args, 'project')}"`);
      if (!title) throw new Error('addProjectTask requires a title');
      await store.updateProject(project.id, {
        tasks: [...project.tasks, { id: uid('ptk'), title, done: false }],
      });
      return `Added "${title}" to ${project.name}.`;
    },
  },
  {
    name: 'logStudySession',
    kind: 'write',
    description: 'Log study time for today.',
    params: [
      { name: 'minutes', type: 'number', description: 'Minutes studied', required: true },
      { name: 'subject', type: 'string', description: 'e.g. DevOps', required: true },
      { name: 'topic', type: 'string', description: 'Topic' },
      { name: 'notes', type: 'string', description: 'What you covered' },
    ],
    run: async (args) => {
      const minutes = Math.max(1, Math.round(argNumber(args, 'minutes', 0)));
      if (!minutes) throw new Error('logStudySession requires minutes');
      const session = await store.addSession({
        minutes,
        subject: argString(args, 'subject', 'DevOps'),
        topic: argString(args, 'topic'),
        notes: argString(args, 'notes'),
        mode: 'custom',
      });
      return `Logged ${formatMinutes(session.minutes)} of ${session.subject} study.`;
    },
  },

  /* --------------------------- destructive --------------------------- */
  {
    name: 'deleteNote',
    kind: 'destructive',
    description: 'Permanently delete a note.',
    params: [{ name: 'title', type: 'string', description: 'Note title (fuzzy match)', required: true }],
    run: async (args, state) => {
      const note = matchByName(state.notes, (item) => item.title, argString(args, 'title'));
      if (!note) throw new Error(`No note matched "${argString(args, 'title')}"`);
      await store.deleteNote(note.id);
      return `Deleted note "${note.title}".`;
    },
  },
  {
    name: 'deleteTask',
    kind: 'destructive',
    description: 'Permanently delete a study task.',
    params: [{ name: 'title', type: 'string', description: 'Task title (fuzzy match)', required: true }],
    run: async (args, state) => {
      const task = matchByName(state.tasks, (item) => item.title, argString(args, 'title'));
      if (!task) throw new Error(`No task matched "${argString(args, 'title')}"`);
      await store.deleteTask(task.id);
      return `Deleted task "${task.title}".`;
    },
  },
  {
    name: 'deleteTopic',
    kind: 'destructive',
    description: 'Permanently delete a topic and its progress.',
    params: [{ name: 'name', type: 'string', description: 'Topic name (fuzzy match)', required: true }],
    run: async (args, state) => {
      const topic = matchByName(state.topics, (item) => item.name, argString(args, 'name'));
      if (!topic) throw new Error(`No topic matched "${argString(args, 'name')}"`);
      await store.deleteTopic(topic.id);
      return `Deleted topic "${topic.name}".`;
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_MAP.get(name);
}

/** Compact tool manifest embedded into the system prompt. */
export function toolManifest(): string {
  return TOOLS.map((tool) => {
    const params = tool.params
      .map((param) => `${param.name}:${param.type}${param.required ? '!' : '?'}`)
      .join(', ');
    return `${tool.name}(${params}) [${tool.kind}] — ${tool.description}`;
  }).join('\n');
}

export interface ToolInvocation {
  name: string;
  args: ToolArgs;
}

/** Validates a model-proposed call, dropping unknown tools and coercing args. */
export function parseToolInvocations(raw: unknown): ToolInvocation[] {
  if (!Array.isArray(raw)) return [];
  const invocations: ToolInvocation[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : typeof record.tool === 'string' ? record.tool : '';
    if (!name || !TOOL_MAP.has(name)) continue;
    const argsSource = record.args ?? record.arguments ?? record.parameters;
    const args: ToolArgs =
      argsSource && typeof argsSource === 'object' && !Array.isArray(argsSource)
        ? (argsSource as ToolArgs)
        : {};
    invocations.push({ name, args });
    if (invocations.length >= 6) break;
  }
  return invocations;
}

/** Human-readable one-liner describing a proposed action, shown in the dialog. */
export function describeInvocation(invocation: ToolInvocation, _state: AppState): string {
  const { name, args } = invocation;
  switch (name) {
    case 'createTask':
      return `New task “${argString(args, 'title')}” on ${argString(args, 'date') || todayISO()} for ${argString(args, 'subject', 'DevOps')} (${argNumber(args, 'plannedMinutes', 60)} min)`;
    case 'completeTask':
      return `Mark task “${argString(args, 'title')}” as completed`;
    case 'createNote':
      return `New note “${argString(args, 'title')}” (${argString(args, 'content').length} characters)`;
    case 'updateNote':
      return `Update note “${argString(args, 'title')}”${argString(args, 'appendContent') ? ' by appending content' : ''}`;
    case 'updateProgress':
      return `Set “${argString(args, 'topic')}” to ${args.progress === undefined ? 'unchanged progress' : `${argNumber(args, 'progress', 0)}%`}`;
    case 'createProject':
      return `New project “${argString(args, 'name')}”`;
    case 'addProjectTask':
      return `Add “${argString(args, 'title')}” to project “${argString(args, 'project')}”`;
    case 'logStudySession':
      return `Log ${argNumber(args, 'minutes', 0)} minutes of ${argString(args, 'subject', 'DevOps')} study`;
    case 'deleteNote':
    case 'deleteTask':
    case 'deleteTopic':
      return `Permanently delete “${argString(args, 'title') || argString(args, 'name')}”`;
    default:
      return `${name}(${JSON.stringify(args)})`;
  }
}
