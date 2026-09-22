/**
 * Domain model for DevOps Learning OS.
 *
 * Everything is plain, serialisable data (JSON-safe) so the whole application
 * state can be exported to a single backup file and restored later.
 */

/* ------------------------------- shared ------------------------------- */

export type ID = string;

/** ISO calendar day, `YYYY-MM-DD`. Avoids timezone drift in date comparisons. */
export type ISODate = string;
/** Full ISO timestamp. */
export type ISODateTime = string;

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

export interface Timestamped {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* -------------------------------- tasks ------------------------------- */

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

export const TASK_STATUSES: TaskStatus[] = ['pending', 'in-progress', 'completed', 'skipped'];

export interface StudyTask extends Timestamped {
  id: ID;
  /** Calendar day the task is planned for. */
  date: ISODate;
  subject: string;
  topic: string;
  title: string;
  plannedMinutes: number;
  actualMinutes: number;
  priority: Priority;
  status: TaskStatus;
  notes: string;
  completedAt?: ISODateTime;
}

/* ------------------------------- courses ------------------------------ */

export type LessonStatus = 'not-started' | 'in-progress' | 'completed';

export interface Lesson {
  id: ID;
  title: string;
  durationMinutes: number;
  status: LessonStatus;
  notes: string;
  needsRevision: boolean;
}

export interface CourseModule {
  id: ID;
  title: string;
  lessons: Lesson[];
}

export type CourseStatus = 'not-started' | 'in-progress' | 'completed' | 'paused';

export interface Course extends Timestamped {
  id: ID;
  name: string;
  instructor: string;
  platform: string;
  url: string;
  category: string;
  /** Used only when the course has no module breakdown yet. */
  totalModules: number;
  completedModules: number;
  status: CourseStatus;
  modules: CourseModule[];
  notes: string;
}

/* ------------------------------- topics ------------------------------- */

export type TopicStatus = 'not-started' | 'learning' | 'practiced' | 'completed' | 'need-revision';

export const TOPIC_STATUSES: TopicStatus[] = [
  'not-started',
  'learning',
  'practiced',
  'completed',
  'need-revision',
];

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface Topic extends Timestamped {
  id: ID;
  name: string;
  category: string;
  status: TopicStatus;
  /** Self-assessed mastery, 0-100. */
  progress: number;
  confidence: Confidence;
  difficulty: Difficulty;
  lastStudiedAt?: ISODate;
  nextRevisionAt?: ISODate;
  revisionCount: number;
  resourceUrl: string;
  notes: string;
}

/* ------------------------------ projects ------------------------------ */

export interface ProjectTask {
  id: ID;
  title: string;
  done: boolean;
}

export type ProjectStatus = 'planned' | 'in-progress' | 'completed' | 'on-hold';

export interface Project extends Timestamped {
  id: ID;
  name: string;
  description: string;
  technologies: string[];
  repoUrl: string;
  startDate: ISODate;
  targetDate: ISODate;
  status: ProjectStatus;
  tasks: ProjectTask[];
  notes: string;
}

/* -------------------------------- notes ------------------------------- */

export interface Note extends Timestamped {
  id: ID;
  title: string;
  topic: string;
  tags: string[];
  content: string;
  pinned: boolean;
  archived: boolean;
}

/* ---------------------------- study sessions -------------------------- */

export type TimerMode = 'pomodoro-25' | 'pomodoro-50' | 'custom';

export interface StudySession {
  id: ID;
  date: ISODate;
  startedAt: ISODateTime;
  minutes: number;
  subject: string;
  topic: string;
  notes: string;
  mode: TimerMode;
}

/* ------------------------- revision log entries ----------------------- */

export interface RevisionRecord {
  id: ID;
  topicId: ID | null;
  topicName: string;
  /** Day the revision was logged. */
  date: ISODate;
  /** 1-5 confidence reported by the learner after revising. */
  confidence: Confidence;
  minutes: number;
  notes: string;
}

/* ------------------------------ AI messages --------------------------- */

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface PendingToolCall {
  id: ID;
  name: string;
  args: Record<string, unknown>;
  summary: string;
  destructive: boolean;
}

export interface ChatMessage {
  id: ID;
  role: ChatRole;
  content: string;
  createdAt: ISODateTime;
  /** Read-only tool results are inlined into the transcript. */
  toolResults?: { name: string; ok: boolean; output: string }[];
  /** Proposed write-actions awaiting explicit confirmation. */
  pending?: PendingToolCall[];
  /** Marks a locally generated answer (offline planner) rather than a model answer. */
  local?: boolean;
  error?: boolean;
}

/* ------------------------------ settings ------------------------------ */

export type ThemeMode = 'dark' | 'light' | 'system';

export type AIProvider = 'none' | 'ollama' | 'openai-compatible';

export interface AISettings {
  provider: AIProvider;
  /** e.g. http://localhost:11434 for Ollama, https://api.openai.com/v1 for OpenAI-compatible. */
  baseUrl: string;
  model: string;
  /** Stored only in this browser's localStorage. Never committed to the repository. */
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

export interface Settings {
  name: string;
  githubUsername: string;
  dailyStudyTargetMinutes: number;
  weeklyStudyTargetMinutes: number;
  targetJobDate: ISODate;
  devopsDailyMinutes: number;
  javaDailyMinutes: number;
  preferredStudyTime: string;
  theme: ThemeMode;
  accent: string;
  weekStartsOn: 0 | 1;
  ai: AISettings;
  seededFromSample: boolean;
}

/* ------------------------------- github ------------------------------- */

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  updatedAt: string;
  createdAt: string;
  url: string;
  homepage: string;
  topics: string[];
  archived: boolean;
  fork: boolean;
}

export interface GitHubEvent {
  id: string;
  type: string;
  repo: string;
  createdAt: string;
  detail: string;
}

export interface GitHubState {
  username: string;
  repositories: GitHubRepo[];
  events: GitHubEvent[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  lastFetchedAt: ISODateTime | null;
}

/* ------------------------------ analytics ----------------------------- */

export interface SubjectProgress {
  subject: string;
  progress: number;
  completed: number;
  total: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  skipped: number;
  completionRate: number;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface DayPlan {
  date: ISODate;
  tasks: StudyTask[];
  plannedMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  targetMinutes: number;
  stats: TaskStats;
}

export interface StreakInfo {
  current: number;
  longest: number;
  activeDays: ISODate[];
  lastActiveDate: ISODate | null;
}

/* ---------------------------- backup format --------------------------- */

export interface BackupPayload {
  app: 'devops-learning-os';
  version: number;
  exportedAt: ISODateTime;
  courses: Course[];
  topics: Topic[];
  tasks: StudyTask[];
  projects: Project[];
  notes: Note[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  settings: Settings;
  meta?: Record<string, unknown>;
}

/* ------------------------------- labels ------------------------------- */

export interface OptionMeta<T extends string> {
  value: T;
  label: string;
  /** Tailwind text/border/hint colour key used by badges and charts. */
  tone: 'neutral' | 'info' | 'brand' | 'ok' | 'warn' | 'danger' | 'accent';
}

export const TASK_STATUS_META: OptionMeta<TaskStatus>[] = [
  { value: 'pending', label: 'Pending', tone: 'neutral' },
  { value: 'in-progress', label: 'In Progress', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'skipped', label: 'Skipped', tone: 'danger' },
];

export const PRIORITY_META: OptionMeta<Priority>[] = [
  { value: 'low', label: 'Low', tone: 'neutral' },
  { value: 'medium', label: 'Medium', tone: 'info' },
  { value: 'high', label: 'High', tone: 'warn' },
  { value: 'critical', label: 'Critical', tone: 'danger' },
];

export const TOPIC_STATUS_META: OptionMeta<TopicStatus>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral' },
  { value: 'learning', label: 'Learning', tone: 'info' },
  { value: 'practiced', label: 'Practiced', tone: 'brand' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'need-revision', label: 'Need Revision', tone: 'warn' },
];

export const COURSE_STATUS_META: OptionMeta<CourseStatus>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral' },
  { value: 'in-progress', label: 'In Progress', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
];

export const PROJECT_STATUS_META: OptionMeta<ProjectStatus>[] = [
  { value: 'planned', label: 'Planned', tone: 'neutral' },
  { value: 'in-progress', label: 'In Progress', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'on-hold', label: 'On Hold', tone: 'warn' },
];

export const LESSON_STATUS_META: OptionMeta<LessonStatus>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral' },
  { value: 'in-progress', label: 'In Progress', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
];

export const DIFFICULTY_META: OptionMeta<Difficulty>[] = [
  { value: 'easy', label: 'Easy', tone: 'ok' },
  { value: 'medium', label: 'Medium', tone: 'warn' },
  { value: 'hard', label: 'Hard', tone: 'danger' },
];

/** Default topic categories, used for grouping, filters and the planner. */
export const TOPIC_CATEGORIES = [
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
  'AWS',
  'Monitoring',
  'Prometheus',
  'Grafana',
  'Python',
  'Java',
  'Spring Boot',
  'SQL',
] as const;

/** Categories the dashboard rolls up into headline progress bars. */
export const HEADLINE_SUBJECTS = [
  'DevOps',
  'AWS',
  'Docker',
  'Kubernetes',
  'Terraform',
  'CI/CD',
  'Monitoring',
  'Java',
] as const;

export const STUDY_SUBJECTS = [
  'DevOps',
  'Linux',
  'Docker',
  'Kubernetes',
  'Terraform',
  'AWS',
  'CI/CD',
  'Monitoring',
  'Java',
  'Spring Boot',
  'Python',
  'DSA',
  'SQL',
  'Other',
] as const;
