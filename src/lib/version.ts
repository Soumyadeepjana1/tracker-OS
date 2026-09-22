/**
 * Application version + deployment identity.
 *
 * `package.json` is the single source of truth: the version is read there by
 * `vite.config.ts` and injected as a build constant, so the running app always
 * reports exactly the version that was built. The commit, branch and repository
 * come from the standard `GITHUB_*` variables that GitHub Actions provides, and
 * stay empty for local builds.
 *
 * Nothing here is hard-coded, and no secret is involved — these are all public
 * values that ship inside a static bundle by design.
 */

export interface BuildInfo {
  version: string;
  /** Short commit SHA, e.g. `a1b2c3d` (empty for local builds). */
  commit: string;
  branch: string;
  /** `owner/name` from `GITHUB_REPOSITORY` (empty for local builds). */
  repo: string;
  builtAt: string;
}

export const BUILD_INFO: BuildInfo = {
  version: __APP_VERSION__,
  commit: __BUILD_COMMIT__,
  branch: __BUILD_BRANCH__,
  repo: __BUILD_REPO__,
  builtAt: __BUILD_TIME__,
};

export const APP_VERSION = BUILD_INFO.version;
export const VERSION_LABEL = `v${APP_VERSION}`;

/** True when this bundle was produced by CI (a commit SHA is present). */
export const IS_CI_BUILD = BUILD_INFO.commit !== '';

/* --------------------------- repository identity -------------------------- */

export interface RepoRef {
  owner: string;
  name: string;
  /** Where the identity came from, so the UI can explain itself. */
  source: 'build' | 'url' | 'settings';
}

const GH_PAGES_HOST = /^([a-z0-9][a-z0-9-]*)\.github\.io$/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Splits `owner/name` (or a bare `name`) into parts, returning null if unusable.
 * Accepts a full URL or a `git@`-style value copied straight from GitHub.
 */
export function splitRepoSlug(value: string): { owner: string; name: string } | null {
  const trimmed = value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  if (!trimmed) return null;
  const [owner, name] = trimmed.split('/');
  // A bare repository name has no owner yet; the caller fills it from the username.
  if (name === undefined) return SEGMENT.test(owner) ? { owner: '', name: owner } : null;
  if (!SEGMENT.test(owner) || !SEGMENT.test(name)) return null;
  return { owner, name };
}

/**
 * Best-effort repository detection, in order of trust:
 *
 * 1. `GITHUB_REPOSITORY` from the CI build — exact.
 * 2. The GitHub Pages URL (`https://<owner>.github.io/<repo>/`) — the running
 *    location tells us the owner and repository without any configuration.
 *
 * Everything else (custom domains, local dev) falls back to Settings.
 */
export function detectRepo(): RepoRef | null {
  if (BUILD_INFO.repo) {
    const parsed = splitRepoSlug(BUILD_INFO.repo);
    if (parsed?.owner && parsed.name) return { ...parsed, source: 'build' };
  }

  if (typeof window === 'undefined') return null;
  const hostMatch = GH_PAGES_HOST.exec(window.location.hostname);
  if (hostMatch) {
    const name = window.location.pathname.split('/').filter(Boolean)[0];
    if (name) return { owner: hostMatch[1], name, source: 'url' };
  }

  return null;
}

export function isLocalHost(): boolean {
  return typeof window !== 'undefined' && LOCAL_HOSTS.has(window.location.hostname);
}

export function isGitHubPages(): boolean {
  return (
    typeof window !== 'undefined' &&
    (GH_PAGES_HOST.test(window.location.hostname) || window.location.hostname.endsWith('.github.io'))
  );
}

/** `owner/name`, or null when the identity is only partially known. */
export function repoSlug(ref: RepoRef | null): string | null {
  if (!ref) return null;
  if (ref.owner && ref.name) return `${ref.owner}/${ref.name}`;
  return ref.name || null;
}

export function repoWebUrl(ref: RepoRef): string {
  return repoSlug(ref) ? `https://github.com/${repoSlug(ref)}` : `https://github.com/${ref.owner}`;
}

export function actionsWebUrl(ref: RepoRef): string {
  const slug = repoSlug(ref);
  return slug ? `https://github.com/${slug}/actions` : 'https://github.com';
}

/** The deployed site itself, derived from the current location. */
export function liveSiteUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const path = window.location.pathname.replace(/\/[^/]*$/, '/');
  return `${origin}${path}`;
}

/** How the app got to where it is running. */
export function deploymentMethod(): string {
  if (isGitHubPages()) return 'GitHub Actions → GitHub Pages';
  if (isLocalHost()) return 'Local development server';
  return 'Static hosting (client-side only)';
}

/* --------------------------- deployment records --------------------------- */

export interface DeploymentRecord {
  version: string;
  commit: string;
  branch: string;
  /** Build timestamp reported by the bundle. */
  builtAt: string;
  /** First time this exact build was seen on this device. */
  firstSeenAt: string;
  /** Last time it was loaded. */
  lastSeenAt: string;
  loads: number;
}

const DEPLOY_RECORD_KEY = 'devops-os:deploy-record';

function readRecord(): DeploymentRecord | null {
  try {
    const raw = localStorage.getItem(DEPLOY_RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeploymentRecord>;
    if (!parsed || typeof parsed !== 'object' || !parsed.builtAt) return null;
    return {
      version: parsed.version ?? '0.0.0',
      commit: parsed.commit ?? '',
      branch: parsed.branch ?? '',
      builtAt: parsed.builtAt,
      firstSeenAt: parsed.firstSeenAt ?? parsed.builtAt,
      lastSeenAt: parsed.lastSeenAt ?? parsed.builtAt,
      loads: typeof parsed.loads === 'number' ? parsed.loads : 1,
    };
  } catch {
    return null;
  }
}

/**
 * Remembers the build currently running on this device.
 *
 * A *new* `builtAt` means a fresh deployment just went live, so the record
 * restarts — that is what powers “last deployment: 2 minutes ago” even when the
 * GitHub API is unavailable or rate limited.
 */
export function recordDeployment(): DeploymentRecord {
  const now = new Date().toISOString();
  const previous = readRecord();

  const record: DeploymentRecord =
    previous && previous.builtAt === BUILD_INFO.builtAt
      ? { ...previous, lastSeenAt: now, loads: previous.loads + 1 }
      : {
          version: BUILD_INFO.version,
          commit: BUILD_INFO.commit,
          branch: BUILD_INFO.branch,
          builtAt: BUILD_INFO.builtAt,
          firstSeenAt: now,
          lastSeenAt: now,
          loads: 1,
        };

  try {
    localStorage.setItem(DEPLOY_RECORD_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — the caller still gets the in-memory record */
  }

  return record;
}

export function readDeploymentRecord(): DeploymentRecord | null {
  return readRecord();
}

/** Human label for the build, e.g. `v1.2.0 · a1b2c3d`. */
export function buildLabel(): string {
  return BUILD_INFO.commit ? `${VERSION_LABEL} · ${BUILD_INFO.commit}` : VERSION_LABEL;
}

/** What the app can say about itself in plain language. */
export function buildDescription(): string {
  const when = new Date(BUILD_INFO.builtAt);
  const stamp = Number.isNaN(when.getTime()) ? BUILD_INFO.builtAt : when.toLocaleString();
  if (IS_CI_BUILD) {
    return `Built by GitHub Actions on ${stamp}${BUILD_INFO.branch ? ` from ${BUILD_INFO.branch}` : ''}.`;
  }
  return `Built locally on ${stamp}. Deploy through GitHub Actions to see commit and branch details here.`;
}
