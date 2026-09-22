import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { AI_PROVIDER_PRESETS, DEFAULT_SETTINGS } from '@/store/defaults';
import { listOllamaModels, testConnection } from '@/ai/providers';
import { BACKUP_FILENAME, generateGitHubBackupFiles, importCounts, parseBackup } from '@/lib/backup';
import { COLLECTIONS } from '@/db/database';
import type { AIProvider, ThemeMode } from '@/types';
import { addDays, formatDate, todayISO } from '@/lib/date';
import { cn, downloadFile } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, IconButton, SectionCard, Segmented, StatCard } from '@/components/ui/primitives';
import { Field, FormGrid, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconAlert,
  IconCheck,
  IconDatabase,
  IconDownload,
  IconExternalLink,
  IconGithub,
  IconMoon,
  IconRefresh,
  IconReset,
  IconSettings,
  IconSparkles,
  IconSun,
  IconTrash,
  IconUpload,
  IconUser,
} from '@/components/icons';

type Tab = 'profile' | 'learning' | 'appearance' | 'ai' | 'data';

const TAB_LABELS: { value: Tab; label: string }[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'learning', label: 'Learning' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'ai', label: 'AI provider' },
  { value: 'data', label: 'Data' },
];

export function SettingsPage() {
  const state = useApp();
  const navigate = useNavigate();
  const [tabParam, setTabParam] = useQueryFlag('tab');
  const [tab, setTab] = useState<Tab>('profile');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [backupOpen, setBackupOpen] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tabParam && TAB_LABELS.some((entry) => entry.value === tabParam)) {
      setTab(tabParam as Tab);
      setTabParam(undefined);
    }
  }, [tabParam, setTabParam]);

  useEffect(() => {
    void store.storageEstimate().then(setStorageInfo);
  }, [state.courses.length, state.notes.length, state.sessions.length]);

  const { settings } = state;
  const ai = settings.ai;

  const counts = useMemo(
    () => ({
      courses: state.courses.length,
      topics: state.topics.length,
      tasks: state.tasks.length,
      projects: state.projects.length,
      notes: state.notes.length,
      sessions: state.sessions.length,
      revisions: state.revisions.length,
    }),
    [state],
  );

  const totalRecords = Object.values(counts).reduce((total, value) => total + value, 0);

  const backupFiles = useMemo(() => generateGitHubBackupFiles(store.getBackupSource()), [backupOpen, state]);

  const handleImport = async (file: File) => {
    const text = await file.text();
    // Validate before touching anything so a bad file can never break the store.
    const preview = parseBackup(text);
    if (!preview.ok) {
      store.toast({ title: 'Import failed', message: preview.error, tone: 'danger' });
      return;
    }
    const summary = importCounts(preview.payload);
    store.requestConfirmation({
      title: importMode === 'replace' ? 'Replace all data?' : 'Merge backup into current data?',
      message:
        importMode === 'replace'
          ? `Everything currently stored will be replaced by this backup.\n\n${summary}`
          : `Records with matching ids will be overwritten.\n\n${summary}`,
      confirmLabel: importMode === 'replace' ? 'Replace data' : 'Merge data',
      tone: importMode === 'replace' ? 'danger' : 'brand',
      onConfirm: async () => {
        const result = await store.applyBackup(text, importMode);
        if (result.ok) {
          store.toast({ title: 'Backup restored', message: result.summary, tone: 'ok' });
        } else {
          store.toast({ title: 'Import failed', message: result.error, tone: 'danger' });
        }
      },
    });
  };

  const runConnectionTest = async () => {
    setTesting(true);
    setConnectionMessage(null);
    try {
      const result = await testConnection(ai);
      setConnectionMessage(`${result.ok ? '✅' : '⚠️'} ${result.message}${result.hint ? ` — ${result.hint}` : ''}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Everything here is stored locally: settings in localStorage, application data in IndexedDB."
        actions={
          <Segmented options={TAB_LABELS} value={tab} onChange={setTab} />
        }
      />

      {tab === 'profile' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            icon={<IconUser size={15} />}
            title="Profile"
            subtitle="Used for greetings and the dashboard header"
            bodyClassName="px-5 py-5"
          >
            <div className="flex flex-col gap-4">
              <FormGrid>
                <Field label="Your name">
                  <Input
                    value={settings.name}
                    placeholder="Soumyadeep"
                    onChange={(event) => void store.updateSettings({ name: event.target.value })}
                  />
                </Field>
                <Field label="GitHub username" hint="Public repositories only — no token required.">
                  <Input
                    value={settings.githubUsername}
                    placeholder="octocat"
                    onChange={(event) => void store.updateSettings({ githubUsername: event.target.value })}
                  />
                </Field>
              </FormGrid>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  icon={<IconGithub size={15} />}
                  loading={state.github.status === 'loading'}
                  onClick={() => void store.refreshGitHub()}
                >
                  Fetch GitHub data
                </Button>
                <Button variant="ghost" icon={<IconExternalLink size={14} />} onClick={() => navigate('/github')}>
                  Open GitHub page
                </Button>
                <span className="text-[11.5px] text-fg-subtle">
                  {settings.githubUsername ? `@${settings.githubUsername}` : 'No username set'}
                </span>
              </div>

              <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] text-fg-muted">
                <p className="font-semibold text-fg">Privacy</p>
                <p className="mt-1">
                  This application has no backend. Your notes, tasks and progress never leave this browser unless you
                  export a backup yourself. The only outbound requests are to the public GitHub API and — if you
                  configure one — your own AI provider.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<IconSettings size={15} />} title="Current setup" subtitle="A quick health check" bodyClassName="px-5 py-4">
            <ul className="flex flex-col gap-2 text-[12.5px]">
              <li className="flex items-center justify-between">
                <span className="text-fg-muted">Theme</span>
                <Badge tone="brand">{settings.theme}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-fg-muted">AI provider</span>
                <Badge tone={ai.provider === 'none' ? 'neutral' : 'ok'}>{ai.provider}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-fg-muted">Daily target</span>
                <span className="font-mono text-fg">{settings.dailyStudyTargetMinutes} min</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-fg-muted">Target date</span>
                <span className="font-mono text-fg">{formatDate(settings.targetJobDate, 'short')}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-fg-muted">Records stored</span>
                <span className="font-mono text-fg">{totalRecords}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-fg-muted">Storage used</span>
                <span className="font-mono text-fg">
                  {storageInfo ? `${(storageInfo.usage / 1024).toFixed(0)} KB` : 'unknown'}
                </span>
              </li>
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              icon={<IconRefresh size={14} />}
              onClick={() => void store.storageEstimate().then(setStorageInfo)}
            >
              Refresh estimate
            </Button>
          </SectionCard>
        </div>
      ) : null}

      {tab === 'learning' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            icon={<IconCheck size={15} />}
            title="Targets"
            subtitle="Drives the progress rings, budget calculations and analytics"
            bodyClassName="px-5 py-5"
          >
            <div className="flex flex-col gap-4">
              <FormGrid>
                <Field label="Daily study target" hint="Minutes per day.">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={settings.dailyStudyTargetMinutes}
                    onChange={(event) => void store.updateSettings({ dailyStudyTargetMinutes: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Weekly study target" hint="Minutes per week.">
                  <Input
                    type="number"
                    min={0}
                    step={60}
                    value={settings.weeklyStudyTargetMinutes}
                    onChange={(event) => void store.updateSettings({ weeklyStudyTargetMinutes: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Target job date">
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={settings.targetJobDate}
                      onChange={(event) => void store.updateSettings({ targetJobDate: event.target.value })}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => void store.updateSettings({ targetJobDate: addDays(todayISO(), 150) })}
                    >
                      150d
                    </Button>
                  </div>
                </Field>
                <Field label="Preferred study time">
                  <Select
                    value={settings.preferredStudyTime}
                    onChange={(event) => void store.updateSettings({ preferredStudyTime: event.target.value })}
                  >
                    {['early morning', 'morning', 'afternoon', 'evening', 'night'].map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="DevOps daily minutes" hint="Suggested split for planning.">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={settings.devopsDailyMinutes}
                    onChange={(event) => void store.updateSettings({ devopsDailyMinutes: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Java daily minutes">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={settings.javaDailyMinutes}
                    onChange={(event) => void store.updateSettings({ javaDailyMinutes: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Week starts on">
                  <Select
                    value={String(settings.weekStartsOn)}
                    onChange={(event) =>
                      void store.updateSettings({ weekStartsOn: Number(event.target.value) === 0 ? 0 : 1 })
                    }
                  >
                    <option value="1">Monday</option>
                    <option value="0">Sunday</option>
                  </Select>
                </Field>
              </FormGrid>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void store.updateSettings(DEFAULT_SETTINGS)}>
                  Reset targets to defaults
                </Button>
                <span className="self-center text-[11.5px] text-fg-subtle">
                  Current split: DevOps {settings.devopsDailyMinutes}m · Java {settings.javaDailyMinutes}m · total{' '}
                  {settings.devopsDailyMinutes + settings.javaDailyMinutes}m
                  {settings.devopsDailyMinutes + settings.javaDailyMinutes !== settings.dailyStudyTargetMinutes
                    ? ' (differs from your daily target)'
                    : ''}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<IconSparkles size={15} />} title="Planning hints" subtitle="Based on your current settings" bodyClassName="px-5 py-4">
            <ul className="flex flex-col gap-2 text-[12.5px] text-fg-muted">
              <li>
                • Roughly {Math.round(settings.devopsDailyMinutes / 60)}h of DevOps and{' '}
                {Math.round(settings.javaDailyMinutes / 60)}h of Java per day.
              </li>
              <li>
                • Weekly target {Math.round(settings.weeklyStudyTargetMinutes / 60)}h — about{' '}
                {Math.round(settings.weeklyStudyTargetMinutes / 7)} min per day.
              </li>
              <li>
                • {formatDate(settings.targetJobDate, 'medium')} is your target date
                {new Date(settings.targetJobDate) < new Date()
                  ? ' — which is in the past, so update it.'
                  : '.'}
              </li>
              <li>• Leave one rest day a week; consistency beats intensity.</li>
            </ul>
          </SectionCard>
        </div>
      ) : null}

      {tab === 'appearance' ? (
        <SectionCard icon={<IconSun size={15} />} title="Appearance" subtitle="Dark theme is the default" bodyClassName="px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                { value: 'dark', label: 'Dark', icon: <IconMoon size={18} />, hint: 'Default — easiest on the eyes for long sessions.' },
                { value: 'light', label: 'Light', icon: <IconSun size={18} />, hint: 'High contrast for bright rooms.' },
                { value: 'system', label: 'System', icon: <IconSettings size={18} />, hint: 'Follows your OS setting.' },
              ] as { value: ThemeMode; label: string; icon: React.ReactNode; hint: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void store.updateSettings({ theme: option.value })}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                  settings.theme === option.value
                    ? 'border-brand bg-brand-soft shadow-[0_0_0_1px_var(--brand)]'
                    : 'border-line bg-surface-2 hover:border-line-strong',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    settings.theme === option.value ? 'bg-brand text-brand-fg' : 'bg-surface-3 text-fg-muted',
                  )}
                >
                  {option.icon}
                </span>
                <span className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
                  {option.label}
                  {settings.theme === option.value ? <IconCheck size={14} /> : null}
                </span>
                <span className="text-[11.5px] text-fg-subtle">{option.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => void store.updateSettings({ theme: 'dark' })}>
              Force dark
            </Button>
            <Button variant="secondary" onClick={() => void store.updateSettings({ theme: 'light' })}>
              Force light
            </Button>
            <span className="text-[11.5px] text-fg-subtle">
              The theme is applied before first paint, so reloading never flashes the wrong colours.
            </span>
          </div>
        </SectionCard>
      ) : null}

      {tab === 'ai' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            icon={<IconSparkles size={15} />}
            title="AI provider (optional)"
            subtitle="Point the assistant at Ollama or any OpenAI-compatible endpoint"
            bodyClassName="px-5 py-5"
          >
            <div className="flex flex-col gap-4">
              <Field label="Provider" hint="Everything works offline — the assistant is never required.">
                <Select
                  value={ai.provider}
                  onChange={(event) => void store.updateSettings({ ai: { ...ai, provider: event.target.value as AIProvider } })}
                >
                  <option value="none">None (offline planner)</option>
                  <option value="ollama">Ollama (local)</option>
                  <option value="openai-compatible">OpenAI-compatible API</option>
                </Select>
              </Field>

              {AI_PROVIDER_PRESETS.filter((entry) => entry.value === ai.provider).map((entry) => (
                <div key={entry.value} className="rounded-xl border border-line bg-surface-2 p-3.5 text-[11.5px] text-fg-muted">
                  {entry.hint} Default endpoint: <code className="font-mono">{entry.baseUrl}</code>
                </div>
              ))}

              {ai.provider !== 'none' ? (
                <>
                  <FormGrid>
                    <Field label="Base URL" hint="Include the API version for OpenAI-compatible servers (…/v1).">
                      <Input
                        value={ai.baseUrl}
                        placeholder="http://localhost:11434"
                        onChange={(event) => void store.updateSettings({ ai: { ...ai, baseUrl: event.target.value } })}
                      />
                    </Field>
                    <Field label="Model">
                      <div className="flex gap-2">
                        <Input
                          value={ai.model}
                          list="ai-model-suggestions"
                          placeholder="llama3.1"
                          onChange={(event) => void store.updateSettings({ ai: { ...ai, model: event.target.value } })}
                        />
                        <datalist id="ai-model-suggestions">
                          {ollamaModels.map((model) => (
                            <option key={model} value={model} />
                          ))}
                        </datalist>
                        {ai.provider === 'ollama' ? (
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              const models = await listOllamaModels(ai.baseUrl);
                              setOllamaModels(models);
                              setConnectionMessage(
                                models.length
                                  ? `Found ${models.length} local model(s): ${models.slice(0, 5).join(', ')}`
                                  : 'No local Ollama models found. Run `ollama pull llama3.1` first.',
                              );
                            }}
                          >
                            List models
                          </Button>
                        ) : null}
                      </div>
                    </Field>
                  </FormGrid>

                  <Field
                    label="API key"
                    hint="Stored only in this browser's localStorage. Never bundled, committed, or sent anywhere except your provider."
                  >
                    <Input
                      type="password"
                      value={ai.apiKey}
                      placeholder={ai.provider === 'ollama' ? 'Not needed for Ollama' : 'sk-…'}
                      onChange={(event) => void store.updateSettings({ ai: { ...ai, apiKey: event.target.value } })}
                    />
                  </Field>

                  <FormGrid>
                    <Field label={`Temperature — ${ai.temperature}`} hint="Lower is more focused.">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={ai.temperature}
                        onChange={(event) =>
                          void store.updateSettings({ ai: { ...ai, temperature: Number(event.target.value) } })
                        }
                        className="mt-3 h-2 w-full cursor-pointer accent-[var(--brand)]"
                      />
                    </Field>
                    <Field label="Max response tokens">
                      <Input
                        type="number"
                        min={64}
                        max={4096}
                        step={64}
                        value={ai.maxTokens}
                        onChange={(event) => void store.updateSettings({ ai: { ...ai, maxTokens: Number(event.target.value) } })}
                      />
                    </Field>
                  </FormGrid>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" loading={testing} onClick={() => void runConnectionTest()}>
                      Test connection
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/assistant')}>
                      Open the assistant
                    </Button>
                    <Button
                      variant="ghost"
                      icon={<IconTrash size={14} />}
                      onClick={() => void store.updateSettings({ ai: { ...DEFAULT_SETTINGS.ai } })}
                    >
                      Clear provider
                    </Button>
                  </div>

                  {connectionMessage ? (
                    <p className="rounded-xl border border-line bg-surface-2 p-3 text-[12px] text-fg-muted">
                      {connectionMessage}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12.5px] text-fg-muted">
                  With no provider configured, the assistant answers from the built-in offline planner: it reads your
                  tasks, courses, topics and revision queue and produces a study plan locally. No data is sent anywhere.
                </div>
              )}
            </div>
          </SectionCard>

          <div className="flex flex-col gap-4">
            <SectionCard icon={<IconAlert size={15} />} title="Security rules" subtitle="How the assistant is constrained" bodyClassName="px-5 py-4">
              <ul className="flex flex-col gap-2 text-[12px] text-fg-muted">
                <li>• No API keys are hard-coded anywhere in the source.</li>
                <li>• The key lives in localStorage on your device only.</li>
                <li>• The model cannot execute code, read files or run shell commands.</li>
                <li>• Read tools run automatically; writes and deletes need a confirmation click.</li>
                <li>• Only a small progress snapshot is sent — never your whole database.</li>
              </ul>
            </SectionCard>

            <SectionCard icon={<IconSettings size={15} />} title="Local setup cheat sheet" bodyClassName="px-5 py-4">
              <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-fg-muted">
{`# Ollama
ollama pull llama3.1
OLLAMA_ORIGINS=* ollama serve

# then in the fields above
Provider : Ollama (local)
Base URL : http://localhost:11434
Model    : llama3.1`}
              </pre>
              <p className="mt-2 text-[11px] text-fg-subtle">
                Browsers block cross-origin requests by default, which is why <code>OLLAMA_ORIGINS</code> is needed when
                the app runs from a different origin (e.g. GitHub Pages).
              </p>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {tab === 'data' ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ['Courses', counts.courses],
                ['Topics', counts.topics],
                ['Tasks', counts.tasks],
                ['Projects', counts.projects],
                ['Notes', counts.notes],
                ['Sessions', counts.sessions],
                ['Revisions', counts.revisions],
                ['Total', totalRecords],
              ] as [string, number][]
            ).map(([label, value]) => (
              <StatCard key={label} label={label} value={value} tone="brand" icon={<IconDatabase size={15} />} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              icon={<IconDownload size={15} />}
              title="Backup & restore"
              subtitle="The safest thing you can do with your progress"
              bodyClassName="px-5 py-5"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    icon={<IconDownload size={15} />}
                    onClick={() => {
                      downloadFile(BACKUP_FILENAME, store.exportBackup());
                      store.toast({ title: 'Backup exported', message: BACKUP_FILENAME, tone: 'ok' });
                    }}
                  >
                    Export all data
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<IconUpload size={15} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import data
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void handleImport(file);
                    }}
                  />
                </div>

                <Field label="Import mode">
                  <Segmented
                    options={[
                      { value: 'replace', label: 'Replace everything' },
                      { value: 'merge', label: 'Merge by id' },
                    ]}
                    value={importMode}
                    onChange={setImportMode}
                  />
                </Field>

                <p className="text-[11.5px] text-fg-subtle">
                  Backups contain courses, topics, tasks, projects, notes, study sessions, revision records and your
                  settings. AI keys are stripped from generated files.
                </p>

                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<IconDownload size={14} />}
                    onClick={() => {
                      downloadFile('devops-notes.md', generateGitHubBackupFiles(store.getBackupSource())[8].content, 'text/markdown');
                      store.toast({ title: 'Notes exported', tone: 'ok' });
                    }}
                  >
                    Export notes
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<IconDownload size={14} />}
                    onClick={() => {
                      downloadFile('devops-progress.md', generateGitHubBackupFiles(store.getBackupSource())[7].content, 'text/markdown');
                      store.toast({ title: 'Progress exported', tone: 'ok' });
                    }}
                  >
                    Export progress
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<IconGithub size={14} />}
                    onClick={() => setBackupOpen(true)}
                  >
                    Generate GitHub backup
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<IconTrash size={15} />}
              title="Danger zone"
              subtitle="Destructive operations always ask for confirmation first"
              bodyClassName="px-5 py-5"
            >
              <div className="flex flex-col gap-3">
                <Button
                  variant="secondary"
                  icon={<IconRefresh size={15} />}
                  onClick={() =>
                    store.requestConfirmation({
                      title: 'Load sample data?',
                      message:
                        'This replaces all current data with a realistic DevOps learning profile (5 courses, 28 topics, 4 projects, notes, sessions and revisions).',
                      confirmLabel: 'Load sample data',
                      tone: 'danger',
                      onConfirm: async () => {
                        await store.loadSampleData();
                      },
                    })
                  }
                >
                  Reload sample data
                </Button>

                <div className="flex flex-wrap gap-2">
                  {COLLECTIONS.map((collection) => (
                    <Button
                      key={collection}
                      variant="ghost"
                      size="sm"
                      icon={<IconTrash size={12} />}
                      onClick={() =>
                        store.requestConfirmation({
                          title: `Clear ${collection}?`,
                          message: `Every record in “${collection}” will be deleted. Other collections are untouched.`,
                          confirmLabel: `Clear ${collection}`,
                          tone: 'danger',
                          onConfirm: async () => {
                            await store.clearCollection(collection);
                            store.toast({ title: `${collection} cleared`, tone: 'info' });
                          },
                        })
                      }
                    >
                      Clear {collection}
                    </Button>
                  ))}
                </div>

                <div className="rounded-xl border border-danger/30 bg-danger-soft p-3.5">
                  <p className="text-[12.5px] font-semibold text-fg">Reset the whole application</p>
                  <p className="mt-1 text-[11.5px] text-fg-muted">
                    Deletes the IndexedDB database, the saved settings, the chat transcript and the timer state. Export a
                    backup first — this cannot be undone.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    icon={<IconReset size={14} />}
                    onClick={() =>
                      store.requestConfirmation({
                        title: 'Reset everything?',
                        message:
                          'All local data will be permanently deleted and the app will start empty. This cannot be undone.',
                        confirmLabel: 'Delete everything',
                        tone: 'danger',
                        onConfirm: async () => {
                          await store.resetApplication();
                          store.toast({ title: 'Application reset', message: 'All local data was deleted.', tone: 'info' });
                        },
                      })
                    }
                  >
                    Reset application
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            icon={<IconDatabase size={15} />}
            title="Where your data lives"
            subtitle="Storage abstraction layers inside the app"
            bodyClassName="px-5 py-5"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {COLLECTIONS.map((collection) => (
                <div key={collection} className="rounded-xl border border-line bg-surface-2 p-3.5">
                  <p className="font-mono text-[12px] font-semibold text-fg">IndexedDB · {collection}</p>
                  <p className="mt-1 text-[11.5px] text-fg-muted">
                    {counts[collection as keyof typeof counts]} record(s) stored locally in this browser.
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <p className="font-mono text-[12px] font-semibold text-fg">localStorage</p>
                <p className="mt-1 text-[11.5px] text-fg-muted">
                  Settings, theme, AI configuration, chat transcript and timer state.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      <Modal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        size="lg"
        title="GitHub backup files"
        description="Files you can commit to a repository to version-control your learning data."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBackupOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              icon={<IconDownload size={15} />}
              onClick={async () => {
                for (const file of backupFiles) {
                  downloadFile(file.path.split('/').pop() ?? 'backup.json', file.content, file.path.endsWith('.md') ? 'text/markdown' : 'application/json');
                  // Small delay so browsers do not drop rapid successive downloads.
                  await new Promise((resolve) => setTimeout(resolve, 350));
                }
                store.toast({ title: 'Backup files downloaded', message: `${backupFiles.length} files`, tone: 'ok' });
              }}
            >
              Download all
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-fg-muted">
            These files contain no secrets — the AI API key is stripped before generation. Commit them under{' '}
            <code className="font-mono">data/</code> to keep a git history of your progress.
          </p>
          <ul className="flex flex-col gap-2">
            {backupFiles.map((file) => (
              <li key={file.path} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                <span className="min-w-40 flex-1 font-mono text-[11.5px] text-fg">{file.path}</span>
                <span className="text-[11px] text-fg-subtle">{file.description}</span>
                <IconButton
                  label={`Download ${file.path}`}
                  size="sm"
                  icon={<IconDownload size={13} />}
                  onClick={() =>
                    downloadFile(
                      file.path.split('/').pop() ?? 'backup.json',
                      file.content,
                      file.path.endsWith('.md') ? 'text/markdown' : 'application/json',
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-line bg-surface-2 p-3.5">
            <p className="text-[11.5px] font-semibold text-fg">Suggested commit message</p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-fg-muted">
              {`chore(data): sync learning backup ${todayISO()}`}
            </pre>
          </div>
        </div>
      </Modal>
    </PageBody>
  );
}
