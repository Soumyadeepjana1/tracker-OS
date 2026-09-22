import type { GitHubEvent, GitHubRepo } from '@/types';

/**
 * GitHub public API access — intentionally **unauthenticated**.
 *
 * The app never asks for, stores, or transmits a personal access token, so no
 * secret can leak from the built frontend. The cost is a 60 requests/hour
 * limit per IP, which is why every failure mode below degrades gracefully
 * instead of throwing at the UI.
 */

const API_BASE = 'https://api.github.com';

export type GitHubErrorKind = 'invalid-username' | 'not-found' | 'rate-limit' | 'network' | 'unknown';

export class GitHubError extends Error {
  kind: GitHubErrorKind;

  constructor(kind: GitHubErrorKind, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.kind = kind;
  }

  get userMessage(): string {
    switch (this.kind) {
      case 'invalid-username':
        return 'That username is not valid. GitHub usernames use letters, numbers and single hyphens.';
      case 'not-found':
        return 'No such GitHub user. Check the spelling of the username in Settings.';
      case 'rate-limit':
        return 'GitHub’s anonymous rate limit is exhausted. Showing the last cached data — try again in a little while.';
      case 'network':
        return 'Could not reach GitHub. You appear to be offline, so cached repository data is being shown.';
      case 'unknown':
      default:
        return 'GitHub request failed. The rest of the app keeps working normally.';
    }
  }
}

const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return 'Enter a GitHub username first.';
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'GitHub usernames may only contain letters, numbers and single hyphens (max 39 characters).';
  }
  return null;
}

async function request<T>(path: string, signal?: AbortSignal, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (response.status === 404) throw new GitHubError('not-found', 'GitHub user not found');
    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining === '0' || response.status === 429) {
        throw new GitHubError('rate-limit', 'GitHub API rate limit reached');
      }
      throw new GitHubError('unknown', `GitHub returned ${response.status}`);
    }
    if (!response.ok) throw new GitHubError('unknown', `GitHub returned ${response.status}`);

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof GitHubError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) throw error;
      throw new GitHubError('network', 'GitHub request timed out');
    }
    throw new GitHubError('network', error instanceof Error ? error.message : 'Network error');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * Reusable GET against a public GitHub REST path.
 *
 * Exported so other features (repository metadata, Actions runs) can reuse the
 * same unauthenticated, timeout-guarded, error-classified request path.
 */
export async function requestGitHub<T>(path: string, options: { timeoutMs?: number } = {}): Promise<T> {
  return request<T>(path, undefined, options.timeoutMs);
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  updated_at: string;
  created_at: string;
  html_url: string;
  homepage: string | null;
  topics?: string[];
  archived: boolean;
  fork: boolean;
}

interface RawEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: { name?: string };
  payload?: {
    size?: number;
    ref_type?: string;
    action?: string;
    ref?: string;
    commits?: { message?: string }[];
    pull_request?: { title?: string; number?: number };
    issue?: { title?: string; number?: number };
    release?: { tag_name?: string };
  };
}

export async function fetchRepositories(username: string, signal?: AbortSignal): Promise<GitHubRepo[]> {
  const invalid = validateUsername(username);
  if (invalid) throw new GitHubError('invalid-username', invalid);

  const repos = await request<RawRepo[]>(
    `/users/${encodeURIComponent(username.trim())}/repos?per_page=100&sort=updated&type=owner`,
    signal,
  );

  return repos
    .map<GitHubRepo>((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description ?? '',
      language: repo.language ?? 'Other',
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.watchers_count,
      openIssues: repo.open_issues_count,
      updatedAt: repo.updated_at,
      createdAt: repo.created_at,
      url: repo.html_url,
      homepage: repo.homepage ?? '',
      topics: repo.topics ?? [],
      archived: repo.archived,
      fork: repo.fork,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function fetchEvents(username: string, signal?: AbortSignal): Promise<GitHubEvent[]> {
  const invalid = validateUsername(username);
  if (invalid) throw new GitHubError('invalid-username', invalid);

  const events = await request<RawEvent[]>(
    `/users/${encodeURIComponent(username.trim())}/events/public?per_page=30`,
    signal,
  );

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    repo: event.repo?.name ?? 'unknown',
    createdAt: event.created_at,
    detail: describeEvent(event),
  }));
}

function describeEvent(event: RawEvent): string {
  const payload = event.payload ?? {};
  switch (event.type) {
    case 'PushEvent':
      return `Pushed ${payload.size ?? payload.commits?.length ?? 1} commit(s) — ${
        payload.commits?.[0]?.message?.split('\n')[0] ?? 'no message'
      }`;
    case 'PullRequestEvent':
      return `${payload.action ?? 'updated'} PR #${payload.pull_request?.number ?? '?'}: ${
        payload.pull_request?.title ?? ''
      }`;
    case 'IssuesEvent':
      return `${payload.action ?? 'updated'} issue #${payload.issue?.number ?? '?'}: ${payload.issue?.title ?? ''}`;
    case 'CreateEvent':
      return `Created ${payload.ref_type ?? 'ref'}${payload.ref ? ` ${payload.ref}` : ''}`;
    case 'WatchEvent':
      return 'Starred the repository';
    case 'ForkEvent':
      return 'Forked the repository';
    case 'ReleaseEvent':
      return `Published release ${payload.release?.tag_name ?? ''}`;
    default:
      return event.type.replace(/Event$/, '');
  }
}

export interface LanguageBreakdown {
  language: string;
  count: number;
  percent: number;
}

export function languageBreakdown(repos: GitHubRepo[]): LanguageBreakdown[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  const total = repos.length || 1;
  return Array.from(counts.entries())
    .map(([language, count]) => ({ language, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function totalStars(repos: GitHubRepo[]): number {
  return repos.reduce((total, repo) => total + repo.stars, 0);
}
