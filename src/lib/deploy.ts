import type {
  DeploymentStatus,
  RepoInfo,
  Settings,
  WorkflowRun,
} from '@/types';
import { GitHubError, requestGitHub, validateUsername } from './github';
import { detectRepo, splitRepoSlug, type RepoRef } from './version';

/**
 * CI/CD visibility.
 *
 * Everything here reads the **public** GitHub REST API without authentication:
 * repository metadata plus recent Actions workflow runs. No token is requested,
 * stored or bundled, so nothing sensitive can leak — the trade-off is the
 * anonymous limit of 60 requests/hour, which is why every function returns a
 * result object instead of throwing into the UI.
 */

export interface DeploymentTarget {
  ref: RepoRef;
  /** `owner/name`. */
  slug: string;
  branch: string;
}

/**
 * Works out which repository/branch to inspect.
 *
 * Settings win, then the CI build's `GITHUB_REPOSITORY`, then the GitHub Pages
 * URL. Returns null when nothing can be determined — the UI then explains how to
 * configure it rather than showing an error.
 */
export function resolveDeploymentTarget(settings: Settings): DeploymentTarget | null {
  const branch = settings.githubBranch.trim() || 'main';
  const configured = settings.githubRepo.trim();

  if (configured) {
    const parsed = splitRepoSlug(configured);
    if (!parsed) return null;
    const owner = parsed.owner || settings.githubUsername.trim();
    if (!owner || !parsed.name) return null;
    return { ref: { owner, name: parsed.name, source: 'settings' }, slug: `${owner}/${parsed.name}`, branch };
  }

  const detected = detectRepo();
  if (!detected?.owner || !detected.name) return null;
  return { ref: detected, slug: `${detected.owner}/${detected.name}`, branch };
}

/** Explains *why* a target could not be resolved, for an empty state. */
export function deploymentConfigHint(settings: Settings): string {
  const configured = settings.githubRepo.trim();
  if (configured && splitRepoSlug(configured) && !splitRepoSlug(configured)?.owner && !settings.githubUsername.trim()) {
    return 'Enter the repository as `owner/name`, or set your GitHub username so the owner can be filled in.';
  }
  if (configured && !splitRepoSlug(configured)) {
    return 'That repository name does not look valid. Use `owner/name`, e.g. `octocat/hello-world`.';
  }
  return 'Set a repository in Settings → Deployment (or run the app from its GitHub Pages URL) to see live deployment status.';
}

/* ------------------------------- mapping -------------------------------- */

interface RawRepoInfo {
  full_name: string;
  description: string | null;
  default_branch: string;
  homepage: string | null;
  html_url: string;
  pushed_at: string;
  stargazers_count: number;
  archived: boolean;
}

interface RawRun {
  id: number;
  name: string | null;
  display_title?: string;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  event: string | null;
  head_sha: string;
  head_commit?: { message?: string | null } | null;
  updated_at: string;
  html_url: string;
}

function toWorkflowRun(run: RawRun): WorkflowRun {
  return {
    id: run.id,
    name: run.name || run.display_title || 'Workflow',
    status: run.status ?? 'completed',
    conclusion: run.conclusion,
    branch: run.head_branch ?? '',
    event: run.event ?? '',
    commit: (run.head_sha ?? '').slice(0, 7),
    message: (run.head_commit?.message ?? '').split('\n')[0] || (run.display_title ?? ''),
    updatedAt: run.updated_at,
    url: run.html_url,
  };
}

/** Collapses GitHub's status/conclusion pair into one UI level. */
export function statusOf(run: WorkflowRun | null | undefined): DeploymentStatus {
  if (!run) return 'unknown';

  switch (run.status) {
    case 'queued':
    case 'requested':
    case 'waiting':
    case 'pending':
      return 'queued';
    case 'in_progress':
      return 'running';
    default:
      break;
  }

  switch (run.conclusion) {
    case 'success':
      return 'success';
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
    case 'action_required':
      return 'failed';
    case 'cancelled':
    case 'skipped':
    case 'neutral':
    case 'stale':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export const STATUS_LABELS: Record<DeploymentStatus, string> = {
  unknown: 'Unknown',
  queued: 'Queued',
  running: 'Building…',
  success: 'Deployed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const STATUS_TONES: Record<DeploymentStatus, 'neutral' | 'info' | 'ok' | 'warn' | 'danger' | 'brand'> = {
  unknown: 'neutral',
  queued: 'info',
  running: 'brand',
  success: 'ok',
  failed: 'danger',
  cancelled: 'warn',
};

/** True for the workflow that publishes the site (name contains deploy/pages). */
export function isDeployWorkflow(run: WorkflowRun): boolean {
  return /deploy|pages|publish/i.test(run.name);
}

export interface RunSummary {
  /** The run that best represents the current deployment state. */
  latest: WorkflowRun | null;
  status: DeploymentStatus;
  /** When the newest successful deployment finished. */
  lastDeployedAt: string | null;
}

export function summarizeRuns(runs: WorkflowRun[], branch: string): RunSummary {
  const ordered = [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const onBranch = ordered.filter((run) => !branch || !run.branch || run.branch === branch);
  const candidates = onBranch.length ? onBranch : ordered;

  // Prefer the deployment workflow so a docs-only workflow does not mask it.
  const latest = candidates.find(isDeployWorkflow) ?? candidates[0] ?? null;

  const lastSuccess = candidates
    .filter((run) => isDeployWorkflow(run) && run.conclusion === 'success')
    .concat(candidates.filter((run) => run.conclusion === 'success'))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  return {
    latest,
    status: statusOf(latest),
    lastDeployedAt: lastSuccess?.updatedAt ?? null,
  };
}

/* ------------------------------- fetching ------------------------------- */

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function validateRepoSlug(slug: string): string | null {
  const parsed = splitRepoSlug(slug);
  if (!parsed || !parsed.owner || !parsed.name) {
    return 'Use the form `owner/repository`, for example `octocat/hello-world`.';
  }
  if (!OWNER_PATTERN.test(parsed.owner)) return 'That GitHub owner name is not valid.';
  if (!REPO_PATTERN.test(parsed.name)) return 'That repository name is not valid.';
  return null;
}

export async function fetchRepoInfo(slug: string): Promise<RepoInfo> {
  if (validateRepoSlug(slug)) throw new GitHubError('invalid-username', 'Invalid repository name');

  const raw = await requestGitHub<RawRepoInfo>(`/repos/${slug}`, { timeoutMs: 12_000 });
  return {
    fullName: raw.full_name,
    description: raw.description ?? '',
    defaultBranch: raw.default_branch,
    homepage: raw.homepage ?? '',
    url: raw.html_url,
    pushedAt: raw.pushed_at,
    stars: raw.stargazers_count,
    archived: raw.archived,
  };
}

export async function fetchWorkflowRuns(slug: string, branch: string, perPage = 8): Promise<WorkflowRun[]> {
  const query = new URLSearchParams({ per_page: String(perPage) });
  if (branch) query.set('branch', branch);

  const raw = await requestGitHub<{ workflow_runs?: RawRun[] }>(`/repos/${slug}/actions/runs?${query.toString()}`, {
    timeoutMs: 12_000,
  });

  return (raw.workflow_runs ?? []).map(toWorkflowRun);
}

export interface DeploymentSnapshot {
  info: RepoInfo;
  runs: WorkflowRun[];
  status: DeploymentStatus;
  lastDeployedAt: string | null;
}

/**
 * Loads repository + Actions data.
 *
 * Returns a discriminated result instead of throwing so the caller can store a
 * friendly message and keep the rest of the app fully usable.
 */
export async function loadDeployment(
  target: DeploymentTarget,
): Promise<{ ok: true; snapshot: DeploymentSnapshot } | { ok: false; error: string }> {
  try {
    const [info, runs] = await Promise.all([
      fetchRepoInfo(target.slug),
      // Actions runs are private for private repos; repository info alone is
      // still useful, so a failure here degrades to an empty run list.
      fetchWorkflowRuns(target.slug, target.branch).catch(() => [] as WorkflowRun[]),
    ]);

    const summary = summarizeRuns(runs, target.branch);
    return {
      ok: true,
      snapshot: {
        info,
        runs,
        status: summary.status,
        lastDeployedAt: summary.lastDeployedAt,
      },
    };
  } catch (error) {
    return { ok: false, error: describeFailure(error) };
  }
}

/** Turns any API/network failure into one actionable sentence. */
export function describeFailure(error: unknown): string {
  if (error instanceof GitHubError) {
    switch (error.kind) {
      case 'not-found':
        return 'That repository was not found, or it is private. Public repositories only — no token is ever used.';
      case 'rate-limit':
        return 'GitHub’s anonymous rate limit is exhausted (60 requests/hour). Showing the last known state — try again later.';
      case 'network':
        return 'Could not reach GitHub. You appear to be offline, so the last known deployment information is shown.';
      case 'invalid-username':
        return error.message;
      default:
        return 'GitHub did not answer as expected. Deployment status is unavailable right now.';
    }
  }
  return 'Deployment status unavailable.';
}

/** Public profile URL for a username, used by the deployment card. */
export function profileUrl(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed || validateUsername(trimmed)) return null;
  return `https://github.com/${trimmed}`;
}
