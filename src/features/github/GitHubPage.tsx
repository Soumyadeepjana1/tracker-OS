import { useMemo, useState } from 'react';
import { store, useApp } from '@/store/store';
import { languageBreakdown, totalStars, validateUsername } from '@/lib/github';
import { formatDate, relativeTime } from '@/lib/date';
import { cn, sum } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionCard,
  Segmented,
  StatCard,
} from '@/components/ui/primitives';
import { Field, FilterToggle, Input, SearchInput, Select } from '@/components/ui/form';
import { DonutChart } from '@/components/charts';
import {
  IconAlert,
  IconExternalLink,
  IconFork,
  IconGithub,
  IconRefresh,
  IconStar,
  IconTerminal,
  IconTrendingUp,
} from '@/components/icons';

type SortKey = 'updated' | 'stars' | 'name' | 'created';

export function GitHubPage() {
  const { github, settings } = useApp();
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [hideForks, setHideForks] = useState(true);
  const [usernameDraft, setUsernameDraft] = useState(settings.githubUsername);

  const languages = useMemo(
    () => Array.from(new Set(github.repositories.map((repo) => repo.language))).sort(),
    [github.repositories],
  );

  const repositories = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return github.repositories
      .filter((repo) => (hideForks ? !repo.fork : true))
      .filter((repo) => (language === 'all' ? true : repo.language === language))
      .filter((repo) =>
        needle
          ? [repo.name, repo.description, repo.language, repo.topics.join(' ')].join(' ').toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'stars') return b.stars - a.stars;
        if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [github.repositories, search, language, sort, hideForks]);

  const stats = useMemo(
    () => ({
      repos: github.repositories.length,
      original: github.repositories.filter((repo) => !repo.fork).length,
      stars: totalStars(github.repositories),
      forks: sum(github.repositories.map((repo) => repo.forks)),
      openIssues: sum(github.repositories.map((repo) => repo.openIssues)),
      languages: languages.length,
    }),
    [github.repositories, languages.length],
  );

  const breakdown = useMemo(() => languageBreakdown(github.repositories), [github.repositories]);
  const recent = useMemo(
    () => github.repositories.filter((repo) => Date.now() - Date.parse(repo.updatedAt) < 1000 * 60 * 60 * 24 * 30),
    [github.repositories],
  );

  const usernameError = usernameDraft ? validateUsername(usernameDraft) : null;

  const saveUsername = async () => {
    if (usernameError) return;
    await store.updateSettings({ githubUsername: usernameDraft.trim() });
    await store.refreshGitHub();
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Public activity"
        title="GitHub"
        description="Your public repositories, pulled straight from GitHub’s unauthenticated API. No token is ever stored in this app."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<IconRefresh size={15} />}
              loading={github.status === 'loading'}
              onClick={() => void store.refreshGitHub()}
            >
              Refresh
            </Button>
            {settings.githubUsername ? (
              <Button
                variant="primary"
                icon={<IconExternalLink size={15} />}
                onClick={() => window.open(`https://github.com/${settings.githubUsername}`, '_blank', 'noopener,noreferrer')}
              >
                Open profile
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="flex flex-wrap items-end gap-3">
        <Field label="GitHub username" error={usernameError ?? undefined} hint="Only public data is fetched — 60 requests/hour without a token." className="min-w-56 flex-1">
          <div className="flex gap-2">
            <Input
              value={usernameDraft}
              placeholder="octocat"
              invalid={Boolean(usernameError)}
              onChange={(event) => setUsernameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveUsername();
              }}
            />
            <Button variant="primary" onClick={() => void saveUsername()} loading={github.status === 'loading'}>
              Save &amp; load
            </Button>
          </div>
        </Field>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-[11px] text-fg-subtle">
            {github.lastFetchedAt ? `Last fetched ${relativeTime(github.lastFetchedAt)}` : 'Never fetched'}
          </span>
          <span className="text-[11px] text-fg-subtle">
            {github.username ? `Showing @${github.username}` : 'No username configured'}
          </span>
        </div>
      </Card>

      {github.status === 'error' ? (
        <Card className="border-warn/40 bg-warn-soft">
          <div className="flex items-start gap-3">
            <IconAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <p className="text-[13px] font-semibold text-fg">GitHub data could not be refreshed</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">{github.error}</p>
              <p className="mt-1 text-[11.5px] text-fg-subtle">
                Everything else in the app keeps working — GitHub is an optional integration.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Public repositories"
          value={stats.repos}
          hint={`${stats.original} original · ${stats.repos - stats.original} forks`}
          icon={<IconGithub size={16} />}
          tone="brand"
        />
        <StatCard label="Stars earned" value={stats.stars} hint="Across all public repositories" icon={<IconStar size={16} />} tone="warn" />
        <StatCard label="Forks" value={stats.forks} hint={`${stats.openIssues} open issue(s) in total`} icon={<IconFork size={16} />} tone="accent" />
        <StatCard
          label="Active this month"
          value={recent.length}
          hint={recent[0] ? `Most recent: ${recent[0].name}` : 'No pushes in the last 30 days'}
          icon={<IconTrendingUp size={16} />}
          tone="ok"
        />
      </div>

      {github.repositories.length ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              className="xl:col-span-2"
              icon={<IconGithub size={15} />}
              title={`${repositories.length} repository/repositories`}
              subtitle={`Sorted by ${sort} · filters applied`}
              action={
                <FilterToggle checked={hideForks} onChange={setHideForks} label="Hide forks" />
              }
              bodyClassName="px-4 py-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Search repositories…" className="min-w-48 flex-1" />
                <Select value={language} onChange={(event) => setLanguage(event.target.value)} className="w-40">
                  <option value="all">All languages</option>
                  {languages.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </Select>
                <Segmented
                  options={[
                    { value: 'updated', label: 'Updated' },
                    { value: 'stars', label: 'Stars' },
                    { value: 'created', label: 'Newest' },
                    { value: 'name', label: 'A–Z' },
                  ]}
                  value={sort}
                  onChange={setSort}
                  size="sm"
                />
              </div>

              {repositories.length ? (
                <ul className="flex flex-col gap-2">
                  {repositories.map((repo) => (
                    <li key={repo.id} className="rounded-xl border border-line bg-surface-2 p-3.5 transition-colors hover:border-line-strong">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[13.5px] font-semibold text-fg hover:text-brand"
                          >
                            <span className="truncate">{repo.name}</span>
                            <IconExternalLink size={12} />
                          </a>
                          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-fg-muted">
                            {repo.description || 'No description provided.'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge tone="neutral">{repo.language}</Badge>
                          {repo.archived ? <Badge tone="warn">archived</Badge> : null}
                          {repo.fork ? <Badge tone="info">fork</Badge> : null}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-fg-subtle">
                        <span className="flex items-center gap-1">
                          <IconStar size={11} />
                          {repo.stars}
                        </span>
                        <span className="flex items-center gap-1">
                          <IconFork size={11} />
                          {repo.forks}
                        </span>
                        {repo.openIssues ? <span>{repo.openIssues} issues</span> : null}
                        <span>updated {formatDate(repo.updatedAt.slice(0, 10), 'short')}</span>
                        <span className="hidden sm:inline">created {formatDate(repo.createdAt.slice(0, 10), 'short')}</span>
                      </div>

                      {repo.topics.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {repo.topics.slice(0, 6).map((topic) => (
                            <span key={topic} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                              {topic}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<IconGithub size={20} />}
                  title="No repositories match your filters"
                  description="Try clearing the search or language filter, or show forks again."
                />
              )}
            </SectionCard>

            <div className="flex flex-col gap-4">
              <SectionCard icon={<IconTerminal size={15} />} title="Language mix" subtitle="By repository count" bodyClassName="px-5 py-4">
                {breakdown.length ? (
                  <div className="flex flex-col gap-3">
                    <DonutChart
                      segments={breakdown.slice(0, 6).map((entry) => ({ label: entry.language, value: entry.count }))}
                      size={140}
                      thickness={15}
                      centerLabel="repos"
                      centerValue={`${stats.repos}`}
                    />
                    <ul className="flex flex-col gap-1.5">
                      {breakdown.slice(0, 6).map((entry) => (
                        <li key={entry.language} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">{entry.language}</span>
                          <span className="w-20">
                            <ProgressBar value={entry.percent} height={4} tone="accent" />
                          </span>
                          <span className="w-8 text-right font-mono text-[11px] text-fg-subtle">{entry.percent}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-fg-muted">No language data yet.</p>
                )}
              </SectionCard>

              <SectionCard
                icon={<IconTrendingUp size={15} />}
                title="Recent public events"
                subtitle={`${github.events.length} event(s) from the GitHub activity feed`}
                bodyClassName="px-5 py-4"
              >
                {github.events.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {github.events.slice(0, 10).map((event) => (
                      <li key={event.id} className="flex items-start gap-2.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-fg">{event.repo}</p>
                          <p className="truncate text-[11px] text-fg-subtle">{event.detail}</p>
                          <p className="text-[10.5px] text-fg-subtle">{relativeTime(event.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-fg-muted">
                    No recent public events. GitHub only exposes events from the last 90 days and they can be rate
                    limited.
                  </p>
                )}
              </SectionCard>
            </div>
          </div>

          <SectionCard
            icon={<IconStar size={15} />}
            title="Most starred"
            subtitle="Your best-performing public repositories"
            bodyClassName="px-5 py-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...github.repositories]
                .sort((a, b) => b.stars - a.stars)
                .slice(0, 3)
                .map((repo) => (
                  <div key={repo.id} className={cn('rounded-xl border border-line bg-surface-2 p-3.5')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold text-fg">{repo.name}</span>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-warn">
                        <IconStar size={11} />
                        {repo.stars}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] text-fg-muted">{repo.description || 'No description.'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge tone="neutral">{repo.language}</Badge>
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-accent hover:underline"
                      >
                        View on GitHub
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </SectionCard>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<IconGithub size={20} />}
            title={settings.githubUsername ? 'No repositories loaded yet' : 'Connect your GitHub profile'}
            description={
              settings.githubUsername
                ? 'Press Refresh to fetch your public repositories. If GitHub’s anonymous rate limit is exhausted, the app keeps working and you can try again later.'
                : 'Enter your username to pull public repository data. No token, no login, no secrets — the dashboard works perfectly without it too.'
            }
            action={
              <Button
                variant="primary"
                icon={<IconRefresh size={15} />}
                loading={github.status === 'loading'}
                onClick={() => (settings.githubUsername ? void store.refreshGitHub() : void saveUsername())}
              >
                {settings.githubUsername ? 'Refresh repositories' : 'Save username & load'}
              </Button>
            }
          />
        </Card>
      )}

      <SectionCard
        icon={<IconAlert size={15} />}
        title="Security notes"
        subtitle="How this integration stays safe"
        bodyClassName="px-5 py-4"
      >
        <ul className="flex flex-col gap-2 text-[12.5px] text-fg-muted">
          <li>• Only the public GitHub REST API is called, without authentication.</li>
          <li>• No personal access token is ever requested, stored, or bundled with the app.</li>
          <li>• Repository data is cached in memory for the session; the app never writes it to your repository.</li>
          <li>• If GitHub is unreachable or rate limited, cached data is shown and every other feature keeps working.</li>
        </ul>
      </SectionCard>
    </PageBody>
  );
}
