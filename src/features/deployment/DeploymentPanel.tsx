import { useMemo } from 'react';
import { store, useApp } from '@/store/store';
import {
  STATUS_LABELS,
  STATUS_TONES,
  deploymentConfigHint,
  statusOf,
  validateRepoSlug,
} from '@/lib/deploy';
import {
  APP_VERSION,
  BUILD_INFO,
  VERSION_LABEL,
  buildDescription,
  deploymentMethod,
  detectRepo,
  liveSiteUrl,
  readDeploymentRecord,
} from '@/lib/version';
import { relativeTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Badge, Button, EmptyState, SectionCard } from '@/components/ui/primitives';
import { Field, FormGrid, Input } from '@/components/ui/form';
import {
  IconAlert,
  IconBranch,
  IconCheckCircle,
  IconExternalLink,
  IconGithub,
  IconRefresh,
  IconRocket,
  IconTag,
  IconTerminal,
  IconZap,
} from '@/components/icons';

/** Tiny version pill — used in the sidebar and the top bar. */
export function VersionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-fg-muted',
        className,
      )}
      title={`${buildDescription()}${BUILD_INFO.commit ? ` Commit ${BUILD_INFO.commit}.` : ''}`}
    >
      <IconTag size={10} />
      {VERSION_LABEL}
    </span>
  );
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Live CI/CD status.
 *
 * Reads the deployment slice from the store, which is filled from the public
 * GitHub API. When that call fails the card shows a friendly message and the
 * locally recorded build — the page never breaks.
 */
export function DeploymentStatusCard({ compact = false }: { compact?: boolean }) {
  const state = useApp();
  const { deployment } = state;

  const record = useMemo(() => readDeploymentRecord(), []);
  const deployRuns = useMemo(() => deployment.runs.filter((run) => !run.branch || run.branch === deployment.branch), [deployment.runs, deployment.branch]);
  const visibleRuns = compact ? deployRuns.slice(0, 3) : deployRuns.slice(0, 5);

  const repoUrl = deployment.repo ? `https://github.com/${deployment.repo}` : null;
  const actionsUrl = deployment.repo ? `https://github.com/${deployment.repo}/actions` : null;
  const liveUrl = liveSiteUrl();
  const isLocal = deployment.source === 'none' && liveUrl.includes('localhost');

  const registeredDeploy = deployment.lastDeployedAt
    ? relativeTime(deployment.lastDeployedAt)
    : record
      ? relativeTime(record.firstSeenAt)
      : 'unknown';
  const deploySource = deployment.lastDeployedAt ? 'GitHub Actions run' : 'recorded on this device';

  return (
    <SectionCard
      icon={<IconRocket size={15} />}
      title="Deployment status"
      subtitle={
        deployment.repo
          ? `${deployment.repo} · ${deployment.branch}`
          : 'GitHub Actions → GitHub Pages'
      }
      action={
        <Button
          variant="secondary"
          size="sm"
          icon={<IconRefresh size={14} />}
          loading={deployment.status === 'loading'}
          onClick={() => void store.refreshDeployment({ force: true })}
        >
          Refresh
        </Button>
      }
      bodyClassName="px-5 py-4"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile
            label="Version"
            value={VERSION_LABEL}
            hint={BUILD_INFO.commit ? `commit ${BUILD_INFO.commit}` : 'local build'}
            icon={<IconTag size={14} />}
            tone="brand"
          />
          <StatusTile
            label="Status"
            value={STATUS_LABELS[deployment.lastStatus]}
            hint={deployment.status === 'loading' ? 'checking…' : deployment.status === 'error' ? 'status unavailable' : `branch ${deployment.branch}`}
            icon={<IconZap size={14} />}
            tone={STATUS_TONES[deployment.lastStatus] === 'ok' ? 'ok' : deployment.lastStatus === 'failed' ? 'danger' : 'info'}
          />
          <StatusTile
            label="Last deployment"
            value={registeredDeploy}
            hint={deploySource}
            icon={<IconCheckCircle size={14} />}
            tone="accent"
          />
          <StatusTile
            label="Repository"
            value={deployment.repo ? deployment.repo.split('/')[1] : '—'}
            hint={deployment.repo ?? 'not configured'}
            icon={<IconGithub size={14} />}
            tone="neutral"
          />
        </div>

        {deployment.status === 'error' ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn-soft p-3.5">
            <IconAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-fg">Deployment status unavailable</p>
              <p className="mt-0.5 text-[12px] text-fg-muted">{deployment.error ?? 'GitHub did not respond.'}</p>
              <p className="mt-1 text-[11.5px] text-fg-subtle">
                The app itself keeps working normally — CI/CD status is an optional read-only integration.
              </p>
            </div>
          </div>
        ) : null}

        {visibleRuns.length ? (
          <ul className="flex flex-col gap-2">
            {visibleRuns.map((run) => {
              const status = statusOf(run);
              return (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
                >
                  <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-fg">{run.name}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">
                    {run.event}
                    {run.commit ? ` · ${run.commit}` : ''}
                  </span>
                  <span className="text-[11px] text-fg-subtle">{relativeTime(run.updatedAt)}</span>
                  <a
                    href={run.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    logs
                    <IconExternalLink size={11} />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : deployment.status === 'ready' ? (
          <p className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] text-fg-muted">
            No workflow runs for <code className="font-mono">{deployment.branch}</code> were returned. Runs are only
            visible for public repositories, and the GitHub API may be rate limited.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button
            variant="secondary"
            size="sm"
            icon={<IconGithub size={14} />}
            disabled={!repoUrl}
            onClick={() => repoUrl && openExternal(repoUrl)}
          >
            Open repository
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<IconZap size={14} />}
            disabled={!actionsUrl}
            onClick={() => actionsUrl && openExternal(actionsUrl)}
          >
            Open Actions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconExternalLink size={14} />}
            onClick={() => openExternal(liveUrl)}
          >
            {isLocal ? 'Open local build' : 'Open live website'}
          </Button>
          <span className="self-center font-mono text-[11px] text-fg-subtle">{liveUrl}</span>
        </div>
      </div>
    </SectionCard>
  );
}

function StatusTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: 'brand' | 'info' | 'ok' | 'danger' | 'accent' | 'neutral';
}) {
  const toneClass: Record<string, string> = {
    brand: 'bg-brand-soft text-brand',
    info: 'bg-info-soft text-info',
    ok: 'bg-ok-soft text-ok',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-accent-soft text-accent',
    neutral: 'bg-surface-3 text-fg-muted',
  };

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', toneClass[tone])}>{icon}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{label}</span>
      </div>
      <p className="mt-2 truncate text-[15px] font-semibold text-fg">{value}</p>
      <p className="truncate text-[11px] text-fg-subtle">{hint}</p>
    </div>
  );
}

/**
 * Settings → Deployment: configuration, live status and build details.
 */
export function DeploymentPanel() {
  const state = useApp();
  const { settings, deployment } = state;

  const detected = useMemo(() => detectRepo(), []);
  const detectedSlug = detected?.owner ? `${detected.owner}/${detected.name}` : null;
  const repoError = settings.githubRepo.trim() ? validateRepoSlug(settings.githubRepo) : null;
  const record = useMemo(() => readDeploymentRecord(), []);
  const liveUrl = liveSiteUrl();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          icon={<IconBranch size={15} />}
          title="Repository & branch"
          subtitle="Used only to read public CI/CD status — no token, no write access"
          bodyClassName="px-5 py-5"
        >
          <div className="flex flex-col gap-4">
            <FormGrid>
              <Field label="GitHub username" hint="Fills in the repository owner when you enter a bare repository name.">
                <Input
                  value={settings.githubUsername}
                  placeholder="octocat"
                  onChange={(event) => void store.updateSettings({ githubUsername: event.target.value.trim() })}
                />
              </Field>
              <Field
                label="Repository"
                hint={detectedSlug ? `Leave empty to use the detected repository (${detectedSlug}).` : 'owner/name, e.g. octocat/hello-world.'}
                error={repoError ?? undefined}
              >
                <Input
                  value={settings.githubRepo}
                  placeholder={detectedSlug ?? 'owner/name'}
                  invalid={Boolean(repoError)}
                  onChange={(event) => void store.updateSettings({ githubRepo: event.target.value.trim() })}
                />
              </Field>
              <Field label="Branch" hint="The branch your deployment workflow listens on.">
                <Input
                  value={settings.githubBranch}
                  placeholder="main"
                  onChange={(event) => void store.updateSettings({ githubBranch: event.target.value })}
                />
              </Field>
            </FormGrid>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                icon={<IconRefresh size={15} />}
                loading={deployment.status === 'loading'}
                onClick={() => void store.refreshDeployment({ force: true })}
              >
                Check deployment status
              </Button>
              <span className="text-[11.5px] text-fg-subtle">
                {detected
                  ? detected.source === 'build'
                    ? 'Repository detected from the CI build.'
                    : 'Repository detected from the GitHub Pages URL.'
                  : 'No repository detected — set it manually.'}
              </span>
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] text-fg-muted">
              <p className="font-semibold text-fg">How updates reach the live site</p>
              <p className="mt-1">
                <code className="font-mono">git push origin main</code> → GitHub Actions installs, lints, tests, builds →
                the bundle is published to GitHub Pages. Nothing here needs your credentials: the app only *reads* public
                metadata to tell you what happened.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={<IconRocket size={15} />}
          title="Deployment method"
          subtitle="Configured by the workflow in your repository"
          bodyClassName="px-5 py-4"
        >
          <ul className="flex flex-col gap-2 text-[12.5px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-fg-muted">Method</span>
              <span className="text-right font-medium text-fg">{deploymentMethod()}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-fg-muted">Branch</span>
              <Badge tone="brand">{settings.githubBranch || 'main'}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-fg-muted">Build source</span>
              <Badge tone={BUILD_INFO.commit ? 'ok' : 'neutral'}>
                {BUILD_INFO.commit ? 'GitHub Actions' : 'local'}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-fg-muted">Repository</span>
              <span className="truncate font-mono text-[11.5px] text-fg">
                {deployment.repo ?? detectedSlug ?? 'not configured'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-fg-muted">Live URL</span>
              <span className="truncate font-mono text-[11.5px] text-fg">{liveUrl}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-fg-muted">Last seen build</span>
              <span className="text-right text-fg">
                {record ? `${relativeTime(record.firstSeenAt)} · ${record.loads} load(s)` : 'unknown'}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-fg-subtle">
            “Last seen build” is recorded locally each time a new bundle loads, so it works offline.
          </p>
        </SectionCard>
      </div>

      <DeploymentStatusCard />

      <SectionCard
        icon={<IconTerminal size={15} />}
        title="About this build"
        subtitle={buildDescription()}
        bodyClassName="px-5 py-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <InfoRow label="Application version" value={VERSION_LABEL} mono />
          <InfoRow label="package.json version" value={APP_VERSION} mono />
          <InfoRow label="Commit" value={BUILD_INFO.commit || '—'} mono />
          <InfoRow label="Branch" value={BUILD_INFO.branch || settings.githubBranch || 'main'} mono />
          <InfoRow
            label="Built at"
            value={Number.isNaN(Date.parse(BUILD_INFO.builtAt)) ? BUILD_INFO.builtAt : new Date(BUILD_INFO.builtAt).toLocaleString()}
          />
          <InfoRow label="CI/CD pipeline" value="GitHub Actions → GitHub Pages" />
          <InfoRow label="Verification manifest" value={`${liveUrl}version.json`} mono />
          <InfoRow label="Detected repository" value={detectedSlug ?? 'not detected'} mono />
          <InfoRow label="Version source of truth" value="package.json" />
        </div>
        <p className="mt-3 text-[11.5px] text-fg-subtle">
          Bump <code className="font-mono">version</code> in <code className="font-mono">package.json</code>, commit, and
          push — the deployed app reports the new version automatically. Tag <code className="font-mono">v1.2.0</code> to
          cut a GitHub Release.
        </p>
      </SectionCard>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p className={cn('mt-1 truncate text-[12.5px] font-medium text-fg', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

/** Compact CI/CD card for the GitHub page. */
export function CicdCard() {
  const state = useApp();
  const { deployment } = state;

  if (deployment.status === 'idle' && !deployment.repo && !deployment.error) {
    return (
      <SectionCard icon={<IconRocket size={15} />} title="CI/CD" subtitle="Deployment pipeline" bodyClassName="px-5 py-4">
        <EmptyState
          icon={<IconRocket size={20} />}
          title="No repository configured"
          description={deploymentConfigHint(state.settings)}
          action={
            <Button variant="primary" icon={<IconRefresh size={15} />} onClick={() => void store.refreshDeployment({ force: true })}>
              Check status
            </Button>
          }
        />
      </SectionCard>
    );
  }

  return <DeploymentStatusCard compact />;
}
