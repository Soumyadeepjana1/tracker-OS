import { useSyncExternalStore } from 'react';
import type {
  ChatMessage,
  Course,
  DeploymentState,
  GitHubRepo,
  GitHubState,
  Note,
  Project,
  QuizAttempt,
  RevisionRecord,
  Settings,
  StudySession,
  StudyTask,
  Topic,
} from '@/types';
import { COLLECTIONS, getStorageWarning, storage, type CollectionName } from '@/db/database';
import { createSampleData } from '@/db/seed';
import { addDays, todayISO } from '@/lib/date';
import { nextRevisionInterval } from '@/lib/progress';
import { uid } from '@/lib/utils';
import {
  buildBackup,
  parseBackup,
  serializeBackup,
  BACKUP_FILENAME,
  type BackupSource,
} from '@/lib/backup';
import { fetchEvents, fetchRepositories, GitHubError } from '@/lib/github';
import {
  deploymentConfigHint,
  loadDeployment,
  resolveDeploymentTarget,
  summarizeRuns,
} from '@/lib/deploy';
import { recordDeployment, type DeploymentRecord } from '@/lib/version';
import { DEFAULT_SETTINGS, applyTheme, loadSettings, mergeSettings, saveSettings } from './defaults';

export type ToastTone = 'info' | 'ok' | 'warn' | 'danger';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
}

export interface ConfirmRequest {
  id: string;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand';
  onConfirm: () => void | Promise<void>;
}

export interface AppState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  persistenceWarning: string | null;
  courses: Course[];
  topics: Topic[];
  tasks: StudyTask[];
  projects: Project[];
  notes: Note[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  quizzes: QuizAttempt[];
  settings: Settings;
  github: GitHubState;
  /** Live CI/CD state for the repository that hosts this app. */
  deployment: DeploymentState;
  /** When this exact build first appeared on this device. */
  deployRecord: DeploymentRecord | null;
  chat: ChatMessage[];
  toasts: ToastMessage[];
  confirm: ConfirmRequest | null;
  lastSavedAt: string | null;
}

const nowIso = () => new Date().toISOString();

function emptyGitHubState(username: string): GitHubState {
  return {
    username,
    repositories: [],
    events: [],
    status: 'idle',
    error: null,
    lastFetchedAt: null,
  };
}

const DEPLOYMENT_CACHE_KEY = 'devops-os:deployment';
/** Deployment status is cached so reloads do not burn the 60/hour API budget. */
const DEPLOYMENT_CACHE_TTL = 10 * 60 * 1000;

function emptyDeploymentState(): DeploymentState {
  return {
    status: 'idle',
    error: null,
    repo: null,
    branch: 'main',
    source: 'none',
    info: null,
    runs: [],
    lastStatus: 'unknown',
    lastDeployedAt: null,
    lastCheckedAt: null,
  };
}

function readCachedDeployment(): DeploymentState | null {
  try {
    const raw = localStorage.getItem(DEPLOYMENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeploymentState>;
    if (!parsed || !parsed.repo) return null;
    return {
      ...emptyDeploymentState(),
      ...parsed,
      status: 'ready',
      error: null,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch {
    return null;
  }
}

function writeCachedDeployment(state: DeploymentState): void {
  try {
    localStorage.setItem(DEPLOYMENT_CACHE_KEY, JSON.stringify({ ...state, error: null }));
  } catch {
    /* storage unavailable — status is simply refetched next time */
  }
}

class Store {
  private state: AppState;
  private listeners = new Set<() => void>();
  private initialized = false;
  private toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    const settings = loadSettings();
    this.state = {
      status: 'loading',
      error: null,
      persistenceWarning: null,
      courses: [],
      topics: [],
      tasks: [],
      projects: [],
      notes: [],
      sessions: [],
      revisions: [],
      quizzes: [],
      settings,
      github: emptyGitHubState(settings.githubUsername),
      deployment: readCachedDeployment() ?? emptyDeploymentState(),
      deployRecord: null,
      chat: [],
      toasts: [],
      confirm: null,
      lastSavedAt: null,
    };
  }

  /* ----------------------------- plumbing ---------------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): AppState => this.state;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  /* ------------------------------ startup ---------------------------- */

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      await storage.init();

      const readCollections = async () => {
        const [courses, topics, tasks, projects, notes, sessions, revisions, quizzes] = await Promise.all([
          storage.getAll<Course>('courses'),
          storage.getAll<Topic>('topics'),
          storage.getAll<StudyTask>('tasks'),
          storage.getAll<Project>('projects'),
          storage.getAll<Note>('notes'),
          storage.getAll<StudySession>('sessions'),
          storage.getAll<RevisionRecord>('revisions'),
          storage.getAll<QuizAttempt>('quizzes'),
        ]);
        return { courses, topics, tasks, projects, notes, sessions, revisions, quizzes };
      };

      let collections = await readCollections();
      const isEmpty = Object.values(collections).every((records) => records.length === 0);

      // A brand-new install starts with a realistic DevOps learning profile
      // instead of an empty dashboard. `loadSampleData` writes straight to state,
      // so the collections are re-read afterwards rather than spreading the stale
      // pre-seed arrays back into the store.
      if (isEmpty && !this.state.settings.seededFromSample) {
        await this.loadSampleData({ silent: true });
        collections = await readCollections();
      }

      this.set({
        ...collections,
        status: 'ready',
        persistenceWarning: getStorageWarning(),
      });

      // Remember which build is running so "last deployment" works even when
      // GitHub is unreachable or rate limited.
      this.set({ deployRecord: recordDeployment() });

      if (this.state.settings.githubUsername) {
        void this.refreshGitHub({ silent: true });
      }
      void this.refreshDeployment({ silent: true });
    } catch (error) {
      console.error('[devops-os] boot failed', error);
      this.set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to open local storage',
      });
    }
  }

  /* --------------------- persistence helper ------------------------- */

  private async persist<T extends { id: string }>(collection: CollectionName, record: T): Promise<void> {
    try {
      await storage.put(collection, record);
      this.set({ lastSavedAt: nowIso() });
    } catch (error) {
      console.error(`[devops-os] failed to persist ${collection}`, error);
      this.toast({
        title: 'Save failed',
        message: 'Your change is in memory but could not be written to IndexedDB.',
        tone: 'danger',
      });
    }
  }

  private async forget(collection: CollectionName, id: string): Promise<void> {
    try {
      await storage.remove(collection, id);
      this.set({ lastSavedAt: nowIso() });
    } catch (error) {
      console.error(`[devops-os] failed to delete from ${collection}`, error);
      this.toast({ title: 'Delete failed', tone: 'danger' });
    }
  }

  /* -------------------------------- UI ------------------------------ */

  toast(input: { title: string; message?: string; tone?: ToastTone; duration?: number }): void {
    const toast: ToastMessage = {
      id: uid('tst'),
      title: input.title,
      message: input.message,
      tone: input.tone ?? 'info',
    };
    this.set({ toasts: [...this.state.toasts, toast] });
    const timer = setTimeout(() => this.dismissToast(toast.id), input.duration ?? 4_200);
    this.toastTimers.set(toast.id, timer);
  }

  dismissToast(id: string): void {
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }
    this.set({ toasts: this.state.toasts.filter((toast) => toast.id !== id) });
  }

  requestConfirmation(request: Omit<ConfirmRequest, 'id'>): void {
    this.set({ confirm: { ...request, id: uid('cfm') } });
  }

  cancelConfirmation(): void {
    this.set({ confirm: null });
  }

  async resolveConfirmation(): Promise<void> {
    const request = this.state.confirm;
    if (!request) return;
    this.set({ confirm: null });
    try {
      await request.onConfirm();
    } catch (error) {
      console.error('[devops-os] confirmed action failed', error);
      this.toast({ title: 'Action failed', message: 'See the console for details.', tone: 'danger' });
    }
  }

  /* ------------------------------ courses ---------------------------- */

  async addCourse(input: Partial<Course> & { name: string }): Promise<Course> {
    const timestamp = nowIso();
    const course: Course = {
      id: uid('crs'),
      name: input.name,
      instructor: input.instructor ?? '',
      platform: input.platform ?? '',
      url: input.url ?? '',
      category: input.category ?? 'DevOps',
      totalModules: input.totalModules ?? 0,
      completedModules: input.completedModules ?? 0,
      status: input.status ?? 'not-started',
      modules: input.modules ?? [],
      notes: input.notes ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.set({ courses: [course, ...this.state.courses] });
    await this.persist('courses', course);
    return course;
  }

  async updateCourse(id: string, patch: Partial<Course>): Promise<void> {
    const existing = this.state.courses.find((course) => course.id === id);
    if (!existing) return;
    const course: Course = { ...existing, ...patch, id, updatedAt: nowIso() };
    this.set({ courses: this.state.courses.map((item) => (item.id === id ? course : item)) });
    await this.persist('courses', course);
  }

  async deleteCourse(id: string): Promise<void> {
    this.set({ courses: this.state.courses.filter((course) => course.id !== id) });
    await this.forget('courses', id);
  }

  /* ------------------------------- topics ---------------------------- */

  async addTopic(input: Partial<Topic> & { name: string; category: string }): Promise<Topic> {
    const timestamp = nowIso();
    const topic: Topic = {
      id: uid('tpc'),
      name: input.name,
      category: input.category,
      status: input.status ?? 'not-started',
      progress: input.progress ?? 0,
      confidence: input.confidence ?? 3,
      difficulty: input.difficulty ?? 'medium',
      lastStudiedAt: input.lastStudiedAt,
      nextRevisionAt: input.nextRevisionAt,
      revisionCount: input.revisionCount ?? 0,
      resourceUrl: input.resourceUrl ?? '',
      notes: input.notes ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.set({ topics: [topic, ...this.state.topics] });
    await this.persist('topics', topic);
    return topic;
  }

  async updateTopic(id: string, patch: Partial<Topic>): Promise<void> {
    const existing = this.state.topics.find((topic) => topic.id === id);
    if (!existing) return;
    const topic: Topic = { ...existing, ...patch, id, updatedAt: nowIso() };
    this.set({ topics: this.state.topics.map((item) => (item.id === id ? topic : item)) });
    await this.persist('topics', topic);
  }

  async deleteTopic(id: string): Promise<void> {
    this.set({ topics: this.state.topics.filter((topic) => topic.id !== id) });
    await this.forget('topics', id);
  }

  /** Records a revision, updating the topic's spacing schedule and confidence. */
  async logRevision(input: {
    topicId: string | null;
    topicName: string;
    confidence: RevisionRecord['confidence'];
    minutes: number;
    notes?: string;
  }): Promise<void> {
    const today = todayISO();
    const record: RevisionRecord = {
      id: uid('rev'),
      topicId: input.topicId,
      topicName: input.topicName,
      date: today,
      confidence: input.confidence,
      minutes: input.minutes,
      notes: input.notes ?? '',
    };
    this.set({ revisions: [record, ...this.state.revisions] });
    await this.persist('revisions', record);

    if (input.topicId) {
      const topic = this.state.topics.find((item) => item.id === input.topicId);
      if (topic) {
        const revisionCount = topic.revisionCount + 1;
        await this.updateTopic(topic.id, {
          confidence: input.confidence,
          revisionCount,
          lastStudiedAt: today,
          nextRevisionAt: addDays(today, nextRevisionInterval(input.confidence, revisionCount)),
          status: input.confidence >= 4 ? 'completed' : topic.status === 'not-started' ? 'learning' : topic.status,
          progress: Math.min(100, Math.max(topic.progress, input.confidence * 20)),
        });
      }
    }
  }

  /* ------------------------------ projects --------------------------- */

  async addProject(input: Partial<Project> & { name: string }): Promise<Project> {
    const timestamp = nowIso();
    const today = todayISO();
    const project: Project = {
      id: uid('prj'),
      name: input.name,
      description: input.description ?? '',
      technologies: input.technologies ?? [],
      repoUrl: input.repoUrl ?? '',
      startDate: input.startDate ?? today,
      targetDate: input.targetDate ?? addDays(today, 30),
      status: input.status ?? 'planned',
      tasks: input.tasks ?? [],
      notes: input.notes ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.set({ projects: [project, ...this.state.projects] });
    await this.persist('projects', project);
    return project;
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<void> {
    const existing = this.state.projects.find((project) => project.id === id);
    if (!existing) return;
    const project: Project = { ...existing, ...patch, id, updatedAt: nowIso() };
    this.set({ projects: this.state.projects.map((item) => (item.id === id ? project : item)) });
    await this.persist('projects', project);
  }

  async deleteProject(id: string): Promise<void> {
    this.set({ projects: this.state.projects.filter((project) => project.id !== id) });
    await this.forget('projects', id);
  }

  async toggleProjectTask(projectId: string, taskId: string): Promise<void> {
    const project = this.state.projects.find((item) => item.id === projectId);
    if (!project) return;
    const tasks = project.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task));
    const allDone = tasks.length > 0 && tasks.every((task) => task.done);
    await this.updateProject(projectId, {
      tasks,
      status: allDone ? 'completed' : project.status === 'completed' ? 'in-progress' : project.status,
    });
  }

  /* -------------------------------- tasks ---------------------------- */

  async addTask(input: Partial<StudyTask> & { title: string }): Promise<StudyTask> {
    const timestamp = nowIso();
    const task: StudyTask = {
      id: uid('tsk'),
      date: input.date ?? todayISO(),
      subject: input.subject ?? 'DevOps',
      topic: input.topic ?? input.subject ?? 'DevOps',
      title: input.title,
      plannedMinutes: input.plannedMinutes ?? 60,
      actualMinutes: input.actualMinutes ?? 0,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'pending',
      notes: input.notes ?? '',
      completedAt: input.status === 'completed' ? timestamp : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.set({ tasks: [task, ...this.state.tasks] });
    await this.persist('tasks', task);
    return task;
  }

  async updateTask(id: string, patch: Partial<StudyTask>): Promise<void> {
    const existing = this.state.tasks.find((task) => task.id === id);
    if (!existing) return;
    const nextStatus = patch.status ?? existing.status;
    const task: StudyTask = {
      ...existing,
      ...patch,
      id,
      updatedAt: nowIso(),
      completedAt: nextStatus === 'completed' ? existing.completedAt ?? nowIso() : undefined,
      actualMinutes:
        patch.actualMinutes ??
        (nextStatus === 'completed' && existing.status !== 'completed'
          ? existing.plannedMinutes
          : existing.actualMinutes),
    };
    this.set({ tasks: this.state.tasks.map((item) => (item.id === id ? task : item)) });
    await this.persist('tasks', task);
  }

  async deleteTask(id: string): Promise<void> {
    this.set({ tasks: this.state.tasks.filter((task) => task.id !== id) });
    await this.forget('tasks', id);
  }

  async toggleTaskCompleted(id: string): Promise<void> {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task) return;
    await this.updateTask(id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  }

  /* -------------------------------- notes ---------------------------- */

  async addNote(input: Partial<Note> & { title: string }): Promise<Note> {
    const timestamp = nowIso();
    const note: Note = {
      id: uid('nte'),
      title: input.title,
      topic: input.topic ?? '',
      tags: input.tags ?? [],
      content: input.content ?? '',
      pinned: input.pinned ?? false,
      archived: input.archived ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.set({ notes: [note, ...this.state.notes] });
    await this.persist('notes', note);
    return note;
  }

  async updateNote(id: string, patch: Partial<Note>): Promise<void> {
    const existing = this.state.notes.find((note) => note.id === id);
    if (!existing) return;
    const note: Note = { ...existing, ...patch, id, updatedAt: nowIso() };
    this.set({ notes: this.state.notes.map((item) => (item.id === id ? note : item)) });
    await this.persist('notes', note);
  }

  async deleteNote(id: string): Promise<void> {
    this.set({ notes: this.state.notes.filter((note) => note.id !== id) });
    await this.forget('notes', id);
  }

  /* ------------------------------ sessions --------------------------- */

  async addSession(input: Partial<StudySession> & { minutes: number }): Promise<StudySession> {
    const today = todayISO();
    const session: StudySession = {
      id: uid('ses'),
      date: input.date ?? today,
      startedAt: input.startedAt ?? nowIso(),
      minutes: input.minutes,
      subject: input.subject ?? 'DevOps',
      topic: input.topic ?? '',
      notes: input.notes ?? '',
      mode: input.mode ?? 'custom',
    };
    this.set({ sessions: [session, ...this.state.sessions] });
    await this.persist('sessions', session);
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    this.set({ sessions: this.state.sessions.filter((session) => session.id !== id) });
    await this.forget('sessions', id);
  }

  /* ------------------------------ settings --------------------------- */

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const settings = mergeSettings(this.state.settings, patch);
    saveSettings(settings);
    applyTheme(settings.theme);
    this.set({ settings });
    if (patch.githubUsername !== undefined && patch.githubUsername !== this.state.github.username) {
      this.set({ github: { ...this.state.github, username: settings.githubUsername } });
    }
    // Repository/branch changes invalidate the cached CI status.
    if (
      patch.githubRepo !== undefined ||
      patch.githubBranch !== undefined ||
      patch.githubUsername !== undefined
    ) {
      void this.refreshDeployment({ silent: true, force: true });
    }
  }

  async resetSettings(): Promise<void> {
    await this.updateSettings(DEFAULT_SETTINGS);
  }

  /* ------------------------------- github ---------------------------- */

  async refreshGitHub(options: { silent?: boolean } = {}): Promise<void> {
    const username = this.state.settings.githubUsername.trim();
    if (!username) {
      if (!options.silent) {
        this.toast({
          title: 'No GitHub username',
          message: 'Add your username in Settings to pull public repository data.',
          tone: 'warn',
        });
      }
      this.set({ github: { ...this.state.github, status: 'idle', error: null } });
      return;
    }

    this.set({ github: { ...this.state.github, username, status: 'loading', error: null } });

    try {
      const [repositories, events] = await Promise.all([
        fetchRepositories(username),
        fetchEvents(username).catch(() => [] as GitHubState['events']),
      ]);

      this.set({
        github: {
          username,
          repositories,
          events,
          status: 'ready',
          error: null,
          lastFetchedAt: nowIso(),
        },
      });

      if (!options.silent) {
        this.toast({
          title: `Loaded ${repositories.length} repositories`,
          message: `Public data for @${username}`,
          tone: 'ok',
        });
      }
    } catch (error) {
      const kind = error instanceof GitHubError ? error.kind : 'unknown';
      const message =
        error instanceof GitHubError
          ? error.userMessage
          : 'GitHub request failed. Everything else keeps working.';

      const cached = kind === 'network' || kind === 'rate-limit' ? this.state.github.repositories : [];

      this.set({
        github: {
          ...this.state.github,
          username,
          status: 'error',
          error: message,
          repositories: cached,
        },
      });

      if (!options.silent) {
        this.toast({ title: 'GitHub unavailable', message, tone: kind === 'not-found' ? 'warn' : 'danger' });
      }
    }
  }

  setRepositories(repositories: GitHubRepo[]): void {
    this.set({ github: { ...this.state.github, repositories, status: 'ready', lastFetchedAt: nowIso() } });
  }

  /* --------------------------------- chat ---------------------------- */

  setChat(chat: ChatMessage[]): void {
    this.set({ chat });
  }

  appendChat(message: ChatMessage): void {
    this.set({ chat: [...this.state.chat, message] });
  }

  patchChat(id: string, patch: Partial<ChatMessage>): void {
    this.set({ chat: this.state.chat.map((message) => (message.id === id ? { ...message, ...patch } : message)) });
  }

  clearChat(): void {
    this.set({ chat: [] });
  }

  /* -------------------------------- CI/CD ----------------------------- */

  /**
   * Loads deployment/CI status from the **public** GitHub API.
   *
   * Never throws: failures are stored as a friendly message and the previously
   * known snapshot is kept, so the dashboard keeps working with no internet.
   */
  async refreshDeployment(options: { silent?: boolean; force?: boolean } = {}): Promise<void> {
    const settings = this.state.settings;
    const target = resolveDeploymentTarget(settings);

    if (!target) {
      this.set({
        deployment: {
          ...emptyDeploymentState(),
          branch: settings.githubBranch || 'main',
          error: deploymentConfigHint(settings),
          status: 'error',
        },
      });
      return;
    }

    const cached = this.state.deployment;
    const cachedIsFresh =
      cached.status === 'ready' &&
      cached.lastCheckedAt !== null &&
      Date.now() - Date.parse(cached.lastCheckedAt) < DEPLOYMENT_CACHE_TTL;

    // Cached-and-fresh: only refresh when explicitly asked.
    if (!options.force && cachedIsFresh && cached.repo === target.slug) return;

    this.set({
      deployment: { ...cached, status: 'loading', error: null, repo: target.slug, branch: target.branch, source: target.ref.source },
    });

    const result = await loadDeployment(target);

    if (!result.ok) {
      const next: DeploymentState = {
        ...this.state.deployment,
        status: 'error',
        error: result.error,
        repo: target.slug,
        branch: target.branch,
        lastCheckedAt: new Date().toISOString(),
      };
      this.set({ deployment: next });
      if (!options.silent) this.toast({ title: 'Deployment status unavailable', message: result.error, tone: 'warn' });
      return;
    }

    const { info, runs, status, lastDeployedAt } = result.snapshot;
    const next: DeploymentState = {
      status: 'ready',
      error: null,
      repo: target.slug,
      branch: target.branch,
      source: target.ref.source,
      info,
      runs,
      lastStatus: status,
      lastDeployedAt,
      lastCheckedAt: new Date().toISOString(),
    };

    writeCachedDeployment(next);
    this.set({ deployment: next });

    if (!options.silent) {
      this.toast({
        title: `Deployment status: ${status}`,
        message: `${info.fullName} · ${runs.length} recent workflow run(s)`,
        tone: status === 'failed' ? 'danger' : status === 'success' ? 'ok' : 'info',
      });
    }
  }

  /** Deployment view used by the AI assistant and the search index. */
  deploymentSummary(): string {
    const { deployment } = this.state;
    if (deployment.status === 'ready' && deployment.info) {
      const summary = summarizeRuns(deployment.runs, deployment.branch);
      return `${deployment.info.fullName} · ${summary.status} · checked ${deployment.lastCheckedAt ?? 'never'}`;
    }
    return deployment.error ?? 'Deployment status unavailable.';
  }

  /* --------------------------------- data ---------------------------- */

  getBackupSource(): BackupSource {
    return {
      courses: this.state.courses,
      topics: this.state.topics,
      tasks: this.state.tasks,
      projects: this.state.projects,
      notes: this.state.notes,
      sessions: this.state.sessions,
      revisions: this.state.revisions,
      quizzes: this.state.quizzes,
      settings: this.state.settings,
    };
  }

  async addQuizAttempt(
    attempt: Omit<QuizAttempt, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<QuizAttempt> {
    const timestamp = nowIso();
    const record: QuizAttempt = {
      id: uid('qz'),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...attempt,
    };
    await storage.put('quizzes', record);
    this.set({ quizzes: [record, ...this.state.quizzes], lastSavedAt: timestamp });
    return record;
  }

  exportBackup(): string {
    return serializeBackup(buildBackup(this.getBackupSource()));
  }

  exportFilename(): string {
    return BACKUP_FILENAME;
  }

  /** Applies a parsed backup. `mode: 'replace'` wipes first, `'merge'` updates by id. */
  async applyBackup(text: string, mode: 'replace' | 'merge'): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
    const result = parseBackup(text);
    if (!result.ok) return result;

    const payload = result.payload;
    const merge = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
      if (mode === 'replace') return incoming;
      const map = new Map(current.map((item) => [item.id, item]));
      for (const item of incoming) map.set(item.id, item);
      return Array.from(map.values());
    };

    const courses = merge(this.state.courses, payload.courses);
    const topics = merge(this.state.topics, payload.topics);
    const tasks = merge(this.state.tasks, payload.tasks);
    const projects = merge(this.state.projects, payload.projects);
    const notes = merge(this.state.notes, payload.notes);
    const sessions = merge(this.state.sessions, payload.sessions);
    const revisions = merge(this.state.revisions, payload.revisions);
    const quizzes = merge(this.state.quizzes, payload.quizzes ?? []);

    const settings = mergeSettings(this.state.settings, { ...payload.settings, seededFromSample: true });
    saveSettings(settings);
    applyTheme(settings.theme);

    try {
      await storage.replaceAll({
        courses,
        topics,
        tasks,
        projects,
        notes,
        sessions,
        revisions,
        quizzes,
      });
    } catch (error) {
      console.error('[devops-os] import persistence failed', error);
      return { ok: false, error: 'Backup parsed successfully but could not be written to local storage.' };
    }

    this.set({
      courses,
      topics,
      tasks,
      projects,
      notes,
      sessions,
      revisions,
      quizzes,
      settings,
      lastSavedAt: nowIso(),
    });

    const summary = `${payload.courses.length} courses, ${payload.topics.length} topics, ${payload.tasks.length} tasks, ${payload.projects.length} projects, ${payload.notes.length} notes, ${payload.sessions.length} sessions, ${quizzes.length} practice attempts`;
    return { ok: true, summary };
  }

  async loadSampleData(options: { silent?: boolean } = {}): Promise<void> {
    const sample = createSampleData();
    try {
      await storage.replaceAll({
        courses: sample.courses,
        topics: sample.topics,
        tasks: sample.tasks,
        projects: sample.projects,
        notes: sample.notes,
        sessions: sample.sessions,
        revisions: sample.revisions,
        quizzes: sample.quizzes,
      });
    } catch (error) {
      console.error('[devops-os] failed to store sample data', error);
    }

    this.set({
      courses: sample.courses,
      topics: sample.topics,
      tasks: sample.tasks,
      projects: sample.projects,
      notes: sample.notes,
      sessions: sample.sessions,
      revisions: sample.revisions,
      quizzes: sample.quizzes,
      lastSavedAt: nowIso(),
    });
    await this.updateSettings({ seededFromSample: true });

    if (!options.silent) {
      this.toast({ title: 'Sample data loaded', message: 'A realistic DevOps learning profile is ready.', tone: 'ok' });
    }
  }

  async clearCollection(collection: CollectionName): Promise<void> {
    try {
      await storage.clear(collection);
    } catch (error) {
      console.error(`[devops-os] failed to clear ${collection}`, error);
    }
    const patch: Partial<AppState> = {};
    if (collection === 'courses') patch.courses = [];
    if (collection === 'topics') patch.topics = [];
    if (collection === 'tasks') patch.tasks = [];
    if (collection === 'projects') patch.projects = [];
    if (collection === 'notes') patch.notes = [];
    if (collection === 'sessions') patch.sessions = [];
    if (collection === 'revisions') patch.revisions = [];
    if (collection === 'quizzes') patch.quizzes = [];
    this.set({ ...patch, lastSavedAt: nowIso() });
  }

  async resetApplication(): Promise<void> {
    await storage.clearAll();
    try {
      localStorage.removeItem('devops-os:settings');
      localStorage.removeItem('devops-os:chat');
      localStorage.removeItem('devops-os:timer');
    } catch {
      /* ignore */
    }
    saveSettings({ ...DEFAULT_SETTINGS, seededFromSample: true });
    applyTheme(DEFAULT_SETTINGS.theme);
    this.set({
      courses: [],
      topics: [],
      tasks: [],
      projects: [],
      notes: [],
      sessions: [],
      revisions: [],
      quizzes: [],
      chat: [],
      github: emptyGitHubState(''),
      settings: { ...DEFAULT_SETTINGS, seededFromSample: true },
      lastSavedAt: nowIso(),
    });
  }

  /** Storage usage for the Settings page. */
  storageEstimate() {
    return storage.estimate();
  }

  collections(): readonly CollectionName[] {
    return COLLECTIONS;
  }
}

export const store = new Store();

/** Subscribes a component to the whole application state. */
export function useApp(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
