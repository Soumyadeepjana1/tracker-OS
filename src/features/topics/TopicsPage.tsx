import { useEffect, useMemo, useState } from 'react';
import { store, useApp } from '@/store/store';
import { needsRevision } from '@/lib/progress';
import { TOPIC_STATUS_META, type Confidence, type Topic, type TopicStatus } from '@/types';
import { formatDate, relativeTime, todayISO } from '@/lib/date';
import { cn, sum } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  SectionCard,
  Segmented,
  StatCard,
  TONE_CLASSES,
} from '@/components/ui/primitives';
import { SearchInput, Select } from '@/components/ui/form';
import { RevisionDialog } from '@/features/shared/RevisionDialog';
import { TopicDialog } from '@/features/shared/TopicDialog';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconCheckCircle,
  IconLayers,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconTrendingUp,
} from '@/components/icons';

type StatusFilter = 'all' | TopicStatus;
type SortKey = 'name' | 'progress' | 'revision' | 'confidence';

export function TopicsPage() {
  const state = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('progress');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [revisionTopic, setRevisionTopic] = useState<Topic | null>(null);

  const [newParam, setNewParam] = useQueryFlag('new');
  const [focusParam, setFocusParam] = useQueryFlag('focus');

  useEffect(() => {
    if (newParam === 'topic') {
      const timer = setTimeout(() => {
        setEditing(null);
        setDialogOpen(true);
        setNewParam(undefined);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [newParam, setNewParam]);

  useEffect(() => {
    if (!focusParam) return;
    const topic = state.topics.find((entry) => entry.id === focusParam);
    if (topic) {
      const timer = setTimeout(() => {
        setEditing(topic);
        setDialogOpen(true);
        setFocusParam(undefined);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setFocusParam(undefined);
    }
  }, [focusParam, state.topics, setFocusParam]);

  const today = todayISO();

  const categories = useMemo(
    () => Array.from(new Set(state.topics.map((topic) => topic.category))).sort(),
    [state.topics],
  );

  const topics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return state.topics
      .filter((topic) => (category === 'all' ? true : topic.category === category))
      .filter((topic) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'need-revision') return needsRevision(topic, today);
        return topic.status === statusFilter;
      })
      .filter((topic) =>
        needle ? [topic.name, topic.category, topic.notes].join(' ').toLowerCase().includes(needle) : true,
      )
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'confidence') return a.confidence - b.confidence;
        if (sort === 'revision') return (a.nextRevisionAt ?? '9999').localeCompare(b.nextRevisionAt ?? '9999');
        return a.progress - b.progress;
      });
  }, [state.topics, search, category, statusFilter, sort, today]);

  const stats = useMemo(() => {
    const byCategory = new Map<string, Topic[]>();
    for (const topic of state.topics) {
      byCategory.set(topic.category, [...(byCategory.get(topic.category) ?? []), topic]);
    }
    return {
      total: state.topics.length,
      completed: state.topics.filter((topic) => topic.status === 'completed').length,
      learning: state.topics.filter((topic) => topic.status === 'learning' || topic.status === 'practiced').length,
      revision: state.topics.filter((topic) => needsRevision(topic, today)).length,
      average: state.topics.length ? Math.round(sum(state.topics.map((topic) => topic.progress)) / state.topics.length) : 0,
      averageConfidence: state.topics.length
        ? sum(state.topics.map((topic) => topic.confidence)) / state.topics.length
        : 0,
      categories: Array.from(byCategory.entries())
        .map(([name, list]) => ({
          name,
          count: list.length,
          progress: Math.round(sum(list.map((topic) => topic.progress)) / list.length),
          revision: list.filter((topic) => needsRevision(topic, today)).length,
        }))
        .sort((a, b) => a.progress - b.progress),
    };
  }, [state.topics, today]);

  const deleteTopic = (topic: Topic) => {
    store.requestConfirmation({
      title: 'Delete topic?',
      message: `“${topic.name}” and its ${topic.revisionCount} revision record(s) will be removed from your progress tracking.`,
      confirmLabel: 'Delete topic',
      tone: 'danger',
      onConfirm: async () => {
        await store.deleteTopic(topic.id);
        store.toast({ title: 'Topic deleted', message: topic.name, tone: 'info' });
      },
    });
  };

  const setConfidence = (topic: Topic, confidence: Confidence) =>
    void store.updateTopic(topic.id, {
      confidence,
      status: confidence >= 4 && topic.status !== 'completed' ? 'practiced' : topic.status,
    });

  return (
    <PageBody>
      <PageHeader
        eyebrow="Topic tracker"
        title="Topics"
        description="Every technology you are learning, with mastery, confidence and a spaced-repetition schedule."
        actions={
          <>
            <Button variant="secondary" icon={<IconRefresh size={15} />} onClick={() => setRevisionTopic(state.topics[0] ?? null)}>
              Log revision
            </Button>
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              Add topic
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Topics tracked"
          value={stats.total}
          hint={`${stats.learning} in progress · ${stats.completed} completed`}
          icon={<IconLayers size={16} />}
          tone="brand"
        />
        <StatCard
          label="Average mastery"
          value={`${stats.average}%`}
          hint={`Average confidence ${stats.averageConfidence.toFixed(1)}/5`}
          icon={<IconTrendingUp size={16} />}
          tone="accent"
          footer={<ProgressBar value={stats.average} />}
        />
        <StatCard
          label="Needs revision"
          value={stats.revision}
          hint="Flagged manually, overdue, or low confidence"
          icon={<IconRefresh size={16} />}
          tone={stats.revision ? 'warn' : 'ok'}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          hint={`${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}% of all tracked topics`}
          icon={<IconCheckCircle size={16} />}
          tone="ok"
        />
      </div>

      <SectionCard
        icon={<IconTrendingUp size={15} />}
        title="Mastery by category"
        subtitle="Weakest first — click a category to filter"
        bodyClassName="px-5 py-4"
      >
        {stats.categories.length ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.categories.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => setCategory(category === entry.name ? 'all' : entry.name)}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-colors',
                  category === entry.name ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-surface-3',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium text-fg">{entry.name}</span>
                  <span className="font-mono text-[11px] text-fg-muted">{entry.progress}%</span>
                </div>
                <ProgressBar value={entry.progress} className="mt-1.5" height={6} />
                <span className="mt-1 block text-[10.5px] text-fg-subtle">
                  {entry.count} topic(s)
                  {entry.revision ? ` · ${entry.revision} need revision` : ''}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-fg-muted">Add topics to see category-level mastery.</p>
        )}
      </SectionCard>

      <Card className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search topics…" className="min-w-56 flex-1" />
        <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-44">
          <option value="all">All categories</option>
          {categories.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="w-40"
        >
          <option value="all">All statuses</option>
          {TOPIC_STATUS_META.map((meta) => (
            <option key={meta.value} value={meta.value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Segmented
          options={[
            { value: 'progress', label: 'Weakest' },
            { value: 'revision', label: 'Revision' },
            { value: 'confidence', label: 'Confidence' },
            { value: 'name', label: 'A–Z' },
          ]}
          value={sort}
          onChange={setSort}
          size="sm"
        />
      </Card>

      <SectionCard
        icon={<IconLayers size={15} />}
        title={`${topics.length} topic(s)`}
        subtitle="Change status inline, or open a topic to edit mastery, difficulty and schedule"
        bodyClassName="px-3 py-3 sm:px-4"
      >
        {topics.length ? (
          <ul className="flex flex-col gap-1.5">
            {topics.map((topic) => {
              const meta = TOPIC_STATUS_META.find((entry) => entry.value === topic.status);
              const due = topic.nextRevisionAt && topic.nextRevisionAt <= today;
              return (
                <li
                  key={topic.id}
                  className="group flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:border-line-strong"
                >
                  <span className={cn('h-8 w-1.5 shrink-0 rounded-full', TONE_CLASSES[meta?.tone ?? 'neutral'].bar)} />

                  <div className="min-w-40 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{topic.name}</p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {topic.category} · {topic.difficulty}
                      {topic.lastStudiedAt ? ` · last studied ${relativeTime(`${topic.lastStudiedAt}T12:00:00.000Z`)}` : ' · never studied'}
                    </p>
                  </div>

                  <div className="hidden w-32 shrink-0 md:block">
                    <ProgressBar value={topic.progress} height={6} />
                    <span className="mt-0.5 block text-right font-mono text-[10px] text-fg-subtle">{topic.progress}%</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5" title="Confidence — click to update">
                    {([1, 2, 3, 4, 5] as Confidence[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-label={`Set confidence ${level} for ${topic.name}`}
                        onClick={() => setConfidence(topic, level)}
                        className={cn(
                          'h-6 w-6 rounded-md border text-[10px] font-bold transition-colors',
                          level <= topic.confidence
                            ? topic.confidence >= 4
                              ? 'border-ok/40 bg-ok-soft text-ok'
                              : topic.confidence === 3
                                ? 'border-brand/40 bg-brand-soft text-brand'
                                : 'border-danger/40 bg-danger-soft text-danger'
                            : 'border-line text-fg-subtle hover:border-line-strong',
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  <select
                    value={topic.status}
                    onChange={(event) => void store.updateTopic(topic.id, { status: event.target.value as TopicStatus })}
                    aria-label={`Status for ${topic.name}`}
                    className="h-7 shrink-0 cursor-pointer rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold text-fg-muted focus:outline-none"
                  >
                    {TOPIC_STATUS_META.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>

                  <Badge tone={due ? 'danger' : 'neutral'}>
                    {topic.nextRevisionAt ? `rev ${formatDate(topic.nextRevisionAt, 'short')}` : 'no schedule'}
                  </Badge>

                  <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton
                      label={`Log revision for ${topic.name}`}
                      size="sm"
                      icon={<IconRefresh size={13} />}
                      onClick={() => setRevisionTopic(topic)}
                    />
                    <IconButton
                      label={`Edit ${topic.name}`}
                      size="sm"
                      icon={<IconPencil size={13} />}
                      onClick={() => {
                        setEditing(topic);
                        setDialogOpen(true);
                      }}
                    />
                    <IconButton
                      label={`Delete ${topic.name}`}
                      size="sm"
                      icon={<IconTrash size={13} />}
                      onClick={() => deleteTopic(topic)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<IconLayers size={20} />}
            title={state.topics.length ? 'No topics match your filters' : 'No topics yet'}
            description={
              state.topics.length
                ? 'Loosen the filters — or add a new topic to the category you are currently studying.'
                : 'Start with Linux, Git and Docker. Adding topics is what turns the dashboard into a real progress tracker.'
            }
            action={
              <Button
                variant="primary"
                icon={<IconPlus size={15} />}
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                Add topic
              </Button>
            }
          />
        )}
      </SectionCard>

      <TopicDialog open={dialogOpen} onClose={() => setDialogOpen(false)} topic={editing} />
      <RevisionDialog open={Boolean(revisionTopic)} onClose={() => setRevisionTopic(null)} topic={revisionTopic} />
    </PageBody>
  );
}
