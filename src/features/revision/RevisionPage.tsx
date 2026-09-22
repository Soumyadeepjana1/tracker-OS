import { useMemo, useState } from 'react';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { needsRevision, revisionUrgency } from '@/lib/progress';
import { addDays, diffDays, formatDate, relativeTime, todayISO } from '@/lib/date';
import { cn, formatMinutes, sum } from '@/lib/utils';
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
  TONE_CLASSES,
} from '@/components/ui/primitives';
import { DonutChart } from '@/components/charts';
import { PracticeModeModal } from '@/features/revision/PracticeModeModal';
import { RevisionDialog } from '@/features/shared/RevisionDialog';
import { TopicDialog } from '@/features/shared/TopicDialog';
import {
  IconBrain,
  IconBulb,
  IconCheckCircle,
  IconClock,
  IconLayers,
  IconRefresh,
  IconSparkles,
  IconTimer,
  IconTrendingUp,
} from '@/components/icons';
import type { Topic } from '@/types';

type View = 'due' | 'upcoming' | 'history';

export function RevisionPage() {
  const state = useApp();
  const analytics = useMemo(() => computeAnalytics(state), [state]);
  const [view, setView] = useState<View>('due');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [revisionTopic, setRevisionTopic] = useState<Topic | null>(null);

  const [practiceModalOpen, setPracticeModalOpen] = useState(false);

  const today = todayISO();

  const due = useMemo(
    () => state.topics.filter((topic) => needsRevision(topic, today)).sort((a, b) => revisionUrgency(b, today) - revisionUrgency(a, today)),
    [state.topics, today],
  );

  const upcoming = useMemo(
    () =>
      state.topics
        .filter((topic) => topic.nextRevisionAt && topic.nextRevisionAt > today)
        .sort((a, b) => (a.nextRevisionAt ?? '').localeCompare(b.nextRevisionAt ?? '')),
    [state.topics, today],
  );

  const history = useMemo(
    () => [...state.revisions].sort((a, b) => b.date.localeCompare(a.date)),
    [state.revisions],
  );

  const confidenceDistribution = useMemo(() => {
    const buckets = [1, 2, 3, 4, 5].map((level) => ({
      label: `${level}/5`,
      value: state.topics.filter((topic) => topic.confidence === level).length,
    }));
    return buckets;
  }, [state.topics]);

  const difficultyBreakdown = useMemo(() => {
    const levels = ['easy', 'medium', 'hard'] as const;
    return levels.map((level) => {
      const list = state.topics.filter((topic) => topic.difficulty === level);
      return {
        level,
        count: list.length,
        progress: list.length ? Math.round(sum(list.map((topic) => topic.progress)) / list.length) : 0,
      };
    });
  }, [state.topics]);

  const dueIn7 = state.topics.filter(
    (topic) => topic.nextRevisionAt && topic.nextRevisionAt > today && topic.nextRevisionAt <= addDays(today, 7),
  ).length;

  const overdue = state.topics.filter((topic) => topic.nextRevisionAt && topic.nextRevisionAt < today).length;
  const revisionMinutes = sum(state.revisions.map((revision) => revision.minutes));

  const logRevision = (topic: Topic) => setRevisionTopic(topic);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Spaced repetition"
        title="Revision"
        description="Revise at the moment you are about to forget. Confidence drives the next interval, so keep it honest."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<IconBrain size={15} />}
              onClick={() => setPracticeModalOpen(true)}
            >
              Start Practice Quiz
            </Button>
            <Button
              variant="secondary"
              icon={<IconSparkles size={15} />}
              onClick={() =>
                store.toast({
                  title: 'Revision questions',
                  message: 'Ask the AI assistant: “Generate revision questions for my due topics.”',
                  tone: 'info',
                })
              }
            >
              Generate questions
            </Button>
            <Button
              variant="primary"
              icon={<IconRefresh size={15} />}
              disabled={!due.length}
              onClick={() => (due[0] ? logRevision(due[0]) : undefined)}
            >
              Revise next topic
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Due now"
          value={due.length}
          hint={`${overdue} overdue · ${dueIn7} coming in the next 7 days`}
          icon={<IconRefresh size={16} />}
          tone={due.length ? 'danger' : 'ok'}
        />
        <StatCard
          label="Revisions logged"
          value={state.revisions.length}
          hint={`${formatMinutes(revisionMinutes)} of revision time`}
          icon={<IconCheckCircle size={16} />}
          tone="ok"
        />
        <StatCard
          label="Average confidence"
          value={`${analytics.topicStats.averageConfidence}/5`}
          hint={`Across ${analytics.topicStats.total} tracked topics`}
          icon={<IconTrendingUp size={16} />}
          tone="brand"
        />
        <StatCard
          label="Scheduled"
          value={upcoming.length}
          hint={upcoming[0]?.nextRevisionAt ? `Next: ${formatDate(upcoming[0].nextRevisionAt, 'short')}` : 'Nothing scheduled ahead'}
          icon={<IconClock size={16} />}
          tone="info"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          icon={<IconBulb size={15} />}
          title="Revision workspace"
          subtitle="Due queue, upcoming schedule and everything you have revised"
          action={
            <Segmented
              options={[
                { value: 'due', label: 'Due', count: due.length },
                { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
                { value: 'history', label: 'History', count: history.length },
              ]}
              value={view}
              onChange={setView}
              size="sm"
            />
          }
          bodyClassName="px-4 py-4"
        >
          {view === 'due' ? (
            due.length ? (
              <ul className="flex flex-col gap-2">
                {due.map((topic) => {
                  const daysOverdue = topic.nextRevisionAt ? diffDays(topic.nextRevisionAt, today) : null;
                  return (
                    <li
                      key={topic.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3"
                    >
                      <span className={cn('h-9 w-1.5 rounded-full', TONE_CLASSES[topic.confidence <= 2 ? 'danger' : 'warn'].bar)} />
                      <div className="min-w-44 flex-1">
                        <p className="truncate text-[13px] font-medium text-fg">{topic.name}</p>
                        <p className="truncate text-[11px] text-fg-subtle">
                          {topic.category} · {topic.difficulty} · confidence {topic.confidence}/5 ·{' '}
                          {topic.lastStudiedAt
                            ? `last studied ${relativeTime(`${topic.lastStudiedAt}T12:00:00.000Z`)}`
                            : 'never studied'}
                        </p>
                      </div>
                      {topic.nextRevisionAt ? (
                        <Badge tone={daysOverdue && daysOverdue > 0 ? 'danger' : 'warn'}>
                          {daysOverdue && daysOverdue > 0
                            ? `${daysOverdue}d overdue`
                            : daysOverdue === 0
                              ? 'due today'
                              : formatDate(topic.nextRevisionAt, 'short')}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">unscheduled</Badge>
                      )}
                      <span className="hidden w-24 sm:block">
                        <ProgressBar value={topic.progress} height={5} />
                      </span>
                      <Button size="sm" variant="primary" icon={<IconRefresh size={13} />} onClick={() => logRevision(topic)}>
                        Revise
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(topic);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<IconCheckCircle size={20} />}
                title="Nothing due for revision"
                description="Every tracked topic is either freshly revised or scheduled in the future. Nice work."
                action={
                  <Button variant="secondary" onClick={() => setView('upcoming')}>
                    See the upcoming schedule
                  </Button>
                }
              />
            )
          ) : null}

          {view === 'upcoming' ? (
            upcoming.length ? (
              <ul className="flex flex-col gap-2">
                {upcoming.map((topic) => {
                  const days = topic.nextRevisionAt ? diffDays(today, topic.nextRevisionAt) : 0;
                  return (
                    <li
                      key={topic.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3"
                    >
                      <span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-surface">
                        <span className="font-mono text-[12.5px] font-semibold text-fg">{days}d</span>
                      </span>
                      <div className="min-w-44 flex-1">
                        <p className="truncate text-[13px] font-medium text-fg">{topic.name}</p>
                        <p className="truncate text-[11px] text-fg-subtle">
                          {topic.category} · confidence {topic.confidence}/5 · {topic.revisionCount} revision(s) so far
                        </p>
                      </div>
                      <Badge tone="info">{formatDate(topic.nextRevisionAt ?? today, 'medium')}</Badge>
                      <Button size="sm" variant="secondary" onClick={() => logRevision(topic)}>
                        Revise early
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<IconClock size={20} />}
                title="No scheduled revisions"
                description="Log a revision on any topic and the next interval is scheduled automatically."
              />
            )
          ) : null}

          {view === 'history' ? (
            history.length ? (
              <ul className="flex flex-col gap-2">
                {history.map((revision) => (
                  <li key={revision.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold',
                        revision.confidence >= 4
                          ? 'bg-ok-soft text-ok'
                          : revision.confidence === 3
                            ? 'bg-brand-soft text-brand'
                            : 'bg-danger-soft text-danger',
                      )}
                    >
                      {revision.confidence}
                    </span>
                    <div className="min-w-40 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-fg">{revision.topicName}</p>
                      <p className="truncate text-[11px] text-fg-subtle">
                        {formatDate(revision.date, 'medium')} · {formatMinutes(revision.minutes)}
                        {revision.notes ? ` · ${revision.notes}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-fg-subtle">{relativeTime(`${revision.date}T12:00:00.000Z`)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<IconClock size={20} />}
                title="No revisions logged yet"
                description="Every revision you log makes the schedule smarter."
              />
            )
          ) : null}
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard
            icon={<IconTrendingUp size={15} />}
            title="Confidence mix"
            subtitle="Where your mastery currently sits"
            bodyClassName="px-5 py-4"
          >
            <DonutChart segments={confidenceDistribution} size={140} thickness={15} centerLabel="topics" centerValue={`${state.topics.length}`} />
          </SectionCard>

          <SectionCard
            icon={<IconLayers size={15} />}
            title="Difficulty × mastery"
            subtitle="Hard topics should get smaller, more frequent revisions"
            bodyClassName="px-5 py-4"
          >
            <ul className="flex flex-col gap-3">
              {difficultyBreakdown.map((entry) => (
                <li key={entry.level}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium capitalize text-fg">{entry.level}</span>
                    <span className="font-mono text-fg-muted">
                      {entry.count} topic(s) · {entry.progress}%
                    </span>
                  </div>
                  <ProgressBar
                    value={entry.progress}
                    tone={entry.level === 'hard' ? 'danger' : entry.level === 'medium' ? 'warn' : 'ok'}
                    className="mt-1.5"
                    height={6}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            icon={<IconTimer size={15} />}
            title="How the schedule works"
            subtitle="Confidence → interval"
            bodyClassName="px-5 py-4"
          >
            <ul className="flex flex-col gap-2 text-[12px] text-fg-muted">
              <li>1/5 → revise tomorrow (you are re-learning)</li>
              <li>2/5 → in 2 days</li>
              <li>3/5 → in 4 days</li>
              <li>4/5 → in a week</li>
              <li>5/5 → in a month</li>
            </ul>
            <p className="mt-3 text-[11.5px] text-fg-subtle">
              Each completed revision stretches the interval further, so strong topics fade from your queue while weak
              ones keep coming back.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                store.toast({
                  title: 'Tip',
                  message: 'Set “Next revision” manually from the topic editor if the ladder is not aggressive enough.',
                  tone: 'info',
                });
              }}
            >
              Fine-tune a topic
            </Button>
          </SectionCard>
        </div>
      </div>

      {state.topics.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconRefresh size={20} />}
            title="No topics to revise yet"
            description="Add a few topics on the Topics page — revision scheduling builds on top of them."
          />
        </Card>
      ) : null}

      <RevisionDialog open={Boolean(revisionTopic)} onClose={() => setRevisionTopic(null)} topic={revisionTopic} />
      <TopicDialog open={dialogOpen} onClose={() => setDialogOpen(false)} topic={editing} />
      <PracticeModeModal open={practiceModalOpen} onClose={() => setPracticeModalOpen(false)} />
    </PageBody>
  );
}
