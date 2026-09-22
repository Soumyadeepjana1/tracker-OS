import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { courseCounts, projectProgress } from '@/lib/progress';
import { formatDate, greeting, relativeTime, todayISO } from '@/lib/date';
import { cn, formatHours, formatMinutes, percent, truncate } from '@/lib/utils';
import { stripMarkdown } from '@/lib/markdown';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  ProgressRing,
  SectionCard,
  StatCard,
  type Tone,
} from '@/components/ui/primitives';
import { ActivityHeatmap, AreaChart, BarChart, DonutChart } from '@/components/charts';
import { MissionControl } from '@/features/dashboard/MissionControl';
import { SessionDialog } from '@/features/shared/SessionDialog';
import { TaskDialog } from '@/features/shared/TaskDialog';
import { RevisionDialog } from '@/features/shared/RevisionDialog';
import {
  IconAlert,
  IconBook,
  IconBulb,
  IconCalendar,
  IconChart,
  IconCheck,
  IconCheckCircle,
  IconCircle,
  IconClock,
  IconExternalLink,
  IconFlame,
  IconFolder,
  IconGithub,
  IconNote,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconStar,
  IconTarget,
  IconTimer,
  IconTrendingUp,
} from '@/components/icons';
import type { StudyTask, Topic } from '@/types';

export function DashboardPage() {
  const state = useApp();
  const navigate = useNavigate();
  const analytics = useMemo(() => computeAnalytics(state), [state]);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [revisionTopic, setRevisionTopic] = useState<Topic | null>(null);

  const { settings } = state;
  const firstName = settings.name ? settings.name.split(' ')[0] : '';
  const todayLabel = formatDate(analytics.today.date, 'long');

  const openNewTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: StudyTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow={todayLabel}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''} 👋`}
        description={
          analytics.daysUntilTarget !== null
            ? analytics.daysUntilTarget >= 0
              ? `Target job date ${formatDate(settings.targetJobDate)} · ${analytics.daysUntilTarget} days to go. Daily target ${formatMinutes(analytics.targetToday)}.`
              : `Your target date (${formatDate(settings.targetJobDate)}) has passed — update it in Settings and re-plan.`
            : `Daily target ${formatMinutes(analytics.targetToday)}.`
        }
        actions={
          <>
            <Button variant="secondary" icon={<IconTimer size={15} />} onClick={() => navigate('/timer')}>
              Focus session
            </Button>
            <Button variant="secondary" icon={<IconCalendar size={15} />} onClick={() => setSessionOpen(true)}>
              Log study time
            </Button>
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={openNewTask}>
              New task
            </Button>
          </>
        }
      />

      {/* --------------------------- mission control --------------------------- */}
      <MissionControl />

      {/* ------------------------------ headline ------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-center gap-5 sm:col-span-2">
          <ProgressRing value={analytics.overall} size={104} strokeWidth={9}>
            <span className="font-mono text-2xl font-semibold text-fg">{analytics.overall}%</span>
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">overall</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-fg">Overall learning progress</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Topics 60% · Courses 25% · Projects 15% weighted blend
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                <p className="font-mono text-base font-semibold text-fg">{analytics.topicStats.total}</p>
                <p className="text-[10.5px] text-fg-subtle">topics</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                <p className="font-mono text-base font-semibold text-fg">{analytics.courseProgressAverage}%</p>
                <p className="text-[10.5px] text-fg-subtle">courses</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                <p className="font-mono text-base font-semibold text-fg">{analytics.projectProgressAverage}%</p>
                <p className="text-[10.5px] text-fg-subtle">projects</p>
              </div>
            </div>
          </div>
        </Card>

        <StatCard
          label="Today"
          value={`${analytics.minutesToday}m`}
          hint={`${analytics.todayProgress}% of ${formatMinutes(analytics.targetToday)} · ${analytics.todayTaskStats.completed}/${analytics.todayTaskStats.total} tasks done`}
          icon={<IconTarget size={16} />}
          tone={analytics.todayProgress >= 100 ? 'ok' : 'brand'}
          footer={<ProgressBar value={analytics.todayProgress} />}
        />

        <StatCard
          label="Current streak"
          value={`${analytics.streak.current}d`}
          hint={`Longest ${analytics.streak.longest} days · last studied ${relativeTime(
            analytics.streak.lastActiveDate ? `${analytics.streak.lastActiveDate}T12:00:00.000Z` : null,
          )}`}
          icon={<IconFlame size={16} />}
          tone={analytics.streak.current > 0 ? 'warn' : 'neutral'}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total study hours"
          value={formatHours(analytics.minutesTotal)}
          hint={`${formatMinutes(analytics.minutesThisWeek)} this week · ${formatMinutes(analytics.minutesThisMonth)} this month`}
          icon={<IconClock size={16} />}
          tone="accent"
        />
        <StatCard
          label="Completed tasks"
          value={analytics.overallTaskStats.completed}
          hint={`${analytics.overallTaskStats.completionRate}% completion rate across ${analytics.overallTaskStats.total} tasks`}
          icon={<IconCheckCircle size={16} />}
          tone="ok"
        />
        <StatCard
          label="Pending tasks"
          value={analytics.overallTaskStats.pending + analytics.overallTaskStats.inProgress}
          hint={`${analytics.overallTaskStats.inProgress} in progress · ${analytics.overallTaskStats.skipped} skipped`}
          icon={<IconCalendar size={16} />}
          tone={analytics.overallTaskStats.pending > 6 ? 'warn' : 'info'}
        />
        <StatCard
          label="Needs revision"
          value={analytics.revisionTopics.length}
          hint={`${analytics.notesCount} notes · average confidence ${analytics.topicStats.averageConfidence}/5`}
          icon={<IconRefresh size={16} />}
          tone={analytics.revisionTopics.length > 3 ? 'danger' : 'warn'}
        />
      </div>

      {/* ------------------------- today + focus next ------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          icon={<IconCalendar size={15} />}
          title={`Today’s plan — ${formatDate(todayISO(), 'medium')}`}
          subtitle={`Target ${formatMinutes(analytics.today.targetMinutes)} · completed ${formatMinutes(
            analytics.today.completedMinutes,
          )} · remaining ${formatMinutes(analytics.today.remainingMinutes)}`}
          action={
            <>
              <Button size="sm" variant="ghost" onClick={() => navigate('/planner')}>
                Open planner
              </Button>
              <Button size="sm" variant="secondary" icon={<IconPlus size={14} />} onClick={openNewTask}>
                Add
              </Button>
            </>
          }
          bodyClassName="px-5 py-4"
        >
          {analytics.today.tasks.length ? (
            <div className="flex flex-col gap-3">
              {groupBySubject(analytics.today.tasks).map((group) => (
                <div key={group.subject}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                      {group.subject}
                    </span>
                    <span className="font-mono text-[11px] text-fg-subtle">
                      {formatMinutes(group.completedMinutes)} / {formatMinutes(group.totalMinutes)}
                    </span>
                  </div>
                  <ProgressBar
                    value={percent(group.completedMinutes, Math.max(1, group.totalMinutes))}
                    height={4}
                    className="mb-2"
                  />
                  <ul className="flex flex-col gap-1">
                    {group.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} onEdit={() => openEditTask(task)} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<IconCalendar size={20} />}
              title="Nothing planned for today"
              description="Your planner is empty. Add a task, or ask the AI assistant to build a plan from your revision queue."
              action={
                <>
                  <Button variant="primary" icon={<IconPlus size={15} />} onClick={openNewTask}>
                    Add a task
                  </Button>
                  <Button variant="secondary" icon={<IconSparkles size={15} />} onClick={() => navigate('/assistant')}>
                    Ask the assistant
                  </Button>
                </>
              }
            />
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard
            icon={<IconBulb size={15} />}
            title="What should I do next?"
            subtitle="Ranked from your pending work"
            bodyClassName="px-5 py-4"
          >
            <ol className="flex flex-col gap-3">
              {analytics.focusSuggestion ? (
                <li className="rounded-xl border border-brand/30 bg-brand-soft p-3.5">
                  <p className="text-[13.5px] font-semibold text-fg">{analytics.focusSuggestion.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-fg-muted">{analytics.focusSuggestion.reason}</p>
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-2.5"
                    icon={<IconTimer size={13} />}
                    onClick={() => navigate('/timer')}
                  >
                    Focus {analytics.focusSuggestion.minutes}m
                  </Button>
                </li>
              ) : null}
              <li className="text-[12.5px] text-fg-muted">
                <span className="font-semibold text-fg">Pending today:</span>{' '}
                {analytics.todayTaskStats.pending} ·{' '}
                <span className="font-semibold text-fg">revision due:</span> {analytics.revisionTopics.length} ·{' '}
                <span className="font-semibold text-fg">consistency:</span> {analytics.consistency}%
              </li>
              {analytics.courseSummaries
                .filter((entry) => entry.progress < 100)
                .sort((a, b) => b.progress - a.progress)
                .slice(0, 2)
                .map((entry) => (
                  <li key={entry.course.id} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                      <IconBook size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-fg">{entry.course.name}</span>
                      <span className="block text-[11px] text-fg-subtle">
                        {entry.remainingModules} module(s) left · {entry.progress}%
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/courses')}>
                      Resume
                    </Button>
                  </li>
                ))}
            </ol>
          </SectionCard>

          <SectionCard
            icon={<IconRefresh size={15} />}
            title="Revision queue"
            subtitle={analytics.revisionTopics.length ? `${analytics.revisionTopics.length} topic(s) due` : 'All clear'}
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate('/revision')}>
                Open
              </Button>
            }
            bodyClassName="px-5 py-4"
          >
            {analytics.revisionTopics.length ? (
              <ul className="flex flex-col gap-2">
                {analytics.revisionTopics.slice(0, 5).map((topic) => (
                  <li key={topic.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-fg">{topic.name}</p>
                      <p className="text-[11px] text-fg-subtle">
                        {topic.category} · confidence {topic.confidence}/5
                        {topic.nextRevisionAt ? ` · due ${formatDate(topic.nextRevisionAt, 'short')}` : ''}
                      </p>
                    </div>
                    <IconButton
                      label={`Log revision for ${topic.name}`}
                      size="sm"
                      variant="secondary"
                      icon={<IconCheck size={14} />}
                      onClick={() => setRevisionTopic(topic)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-fg-muted">Nothing due for revision. Keep the streak alive by reviewing a note.</p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* --------------------------- progress + charts ------------------------ */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          icon={<IconTrendingUp size={15} />}
          title="Subject progress"
          subtitle="Average mastery across your tracked topics"
          bodyClassName="px-5 py-4"
        >
          <div className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
            {analytics.subjectProgress.map((entry) => (
              <div key={entry.subject}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-fg">{entry.subject}</span>
                  <span className="font-mono text-[11.5px] text-fg-muted">
                    {entry.progress}%{entry.total ? ` · ${entry.completed}/${entry.total}` : ''}
                  </span>
                </div>
                <ProgressBar value={entry.progress} className="mt-1.5" height={7} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={<IconChart size={15} />}
          title="Study time by subject"
          subtitle="From your logged sessions"
          bodyClassName="px-5 py-4"
        >
          {analytics.subjectMinutesSeries.length ? (
            <DonutChart
              segments={analytics.subjectMinutesSeries.map((entry) => ({ label: entry.label, value: entry.value }))}
              size={150}
              thickness={16}
              centerLabel="hours"
              centerValue={`${Math.round(analytics.minutesTotal / 60)}`}
            />
          ) : (
            <EmptyState title="No sessions yet" description="Log study time to see where your hours go." icon={<IconChart size={20} />} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={<IconTrendingUp size={15} />}
          title="Daily study hours"
          subtitle="Last 14 days"
          bodyClassName="px-5 py-4"
        >
          <AreaChart data={analytics.dailySeries} height={140} />
        </SectionCard>
        <SectionCard
          icon={<IconChart size={15} />}
          title="Weekly totals"
          subtitle="Last 8 weeks"
          bodyClassName="px-5 py-4"
        >
          <BarChart data={analytics.weeklySeries.map((entry) => ({ label: entry.label, value: entry.value }))} height={140} />
        </SectionCard>
      </div>

      <SectionCard
        icon={<IconFlame size={15} />}
        title="Study activity"
        subtitle={`${analytics.activeDays.length} active days · ${analytics.consistency}% consistency over 28 days`}
        bodyClassName="px-5 py-4"
      >
        <ActivityHeatmap cells={analytics.heatmap} />
      </SectionCard>

      {/* ----------------------------- courses + projects -------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          icon={<IconBook size={15} />}
          title="Course progress"
          subtitle={`${analytics.courseSummaries.length} courses · ${analytics.courseProgressAverage}% average`}
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/courses')}>
              Manage
            </Button>
          }
          bodyClassName="px-5 py-4"
        >
          {analytics.courseSummaries.length ? (
            <ul className="flex flex-col gap-3.5">
              {analytics.courseSummaries.map((entry) => {
                const counts = courseCounts(entry.course);
                return (
                  <li key={entry.course.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">{entry.course.name}</p>
                        <p className="text-[11px] text-fg-subtle">
                          {entry.course.platform || 'Self paced'}
                          {counts.totalLessons ? ` · ${counts.completedLessons}/${counts.totalLessons} lessons` : ''}
                        </p>
                      </div>
                      <Badge tone={entry.progress >= 100 ? 'ok' : 'brand'}>{entry.progress}%</Badge>
                    </div>
                    <ProgressBar value={entry.progress} className="mt-2" height={6} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No courses yet" description="Add the course you are currently working through." icon={<IconBook size={20} />} />
          )}
        </SectionCard>

        <SectionCard
          icon={<IconFolder size={15} />}
          title="Project progress"
          subtitle={`${analytics.projectSummaries.length} projects · ${analytics.projectProgressAverage}% average`}
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/projects')}>
              Manage
            </Button>
          }
          bodyClassName="px-5 py-4"
        >
          {analytics.projectSummaries.length ? (
            <ul className="flex flex-col gap-3.5">
              {analytics.projectSummaries.map((entry) => (
                <li key={entry.project.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-fg">{entry.project.name}</p>
                      <p className="truncate text-[11px] text-fg-subtle">
                        {entry.done}/{entry.total} tasks
                        {entry.project.technologies.length ? ` · ${entry.project.technologies.slice(0, 3).join(', ')}` : ''}
                      </p>
                    </div>
                    <Badge tone={entry.progress >= 100 ? 'ok' : 'accent'}>{entry.progress}%</Badge>
                  </div>
                  <ProgressBar value={projectProgress(entry.project)} className="mt-2" height={6} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No projects yet" description="Portfolio projects are what get you hired." icon={<IconFolder size={20} />} />
          )}
        </SectionCard>
      </div>

      {/* --------------------------- github + notes -------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          icon={<IconGithub size={15} />}
          title="GitHub activity"
          subtitle={
            state.github.username
              ? `@${state.github.username} · ${state.github.repositories.length} public repos · refreshed ${relativeTime(state.github.lastFetchedAt)}`
              : 'Add your GitHub username in Settings'
          }
          action={
            <>
              <Button size="sm" variant="ghost" loading={state.github.status === 'loading'} onClick={() => void store.refreshGitHub()}>
                Refresh
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/github')}>
                Open
              </Button>
            </>
          }
          bodyClassName="px-5 py-4"
        >
          {state.github.status === 'error' ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn-soft p-3 text-[12.5px] text-warn">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <p>{state.github.error}</p>
            </div>
          ) : null}

          {state.github.repositories.length ? (
            <ul className="flex flex-col gap-2">
              {state.github.repositories.slice(0, 4).map((repo) => (
                <li key={repo.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                    <IconFolder size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">{repo.name}</p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {truncate(repo.description || 'No description', 70)}
                    </p>
                  </div>
                  <span className="hidden items-center gap-2 font-mono text-[11px] text-fg-subtle sm:flex">
                    <span className="flex items-center gap-1">
                      <IconStar size={11} />
                      {repo.stars}
                    </span>
                    <Badge tone="neutral">{repo.language}</Badge>
                  </span>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg-subtle transition-colors hover:text-brand"
                    aria-label={`Open ${repo.name} on GitHub`}
                  >
                    <IconExternalLink size={14} />
                  </a>
                </li>
              ))}
            </ul>
          ) : state.github.status === 'loading' ? (
            <p className="text-[12.5px] text-fg-muted">Loading public repositories…</p>
          ) : (
            <EmptyState
              icon={<IconGithub size={20} />}
              title="No GitHub data yet"
              description="Set your username in Settings to pull public repositories. The app works fine without it."
              action={
                <Button variant="secondary" onClick={() => navigate('/settings')}>
                  Set username
                </Button>
              }
            />
          )}
        </SectionCard>

        <SectionCard
          icon={<IconNote size={15} />}
          title="Recent notes"
          subtitle={`${analytics.notesCount} active · ${analytics.archivedNotesCount} archived`}
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/notes')}>
              All notes
            </Button>
          }
          bodyClassName="px-5 py-4"
        >
          {analytics.recentNotes.length ? (
            <ul className="flex flex-col gap-2.5">
              {analytics.recentNotes.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/notes?focus=${note.id}`)}
                    className="w-full text-left"
                  >
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {note.pinned ? '📌 ' : ''}
                      {note.title}
                    </p>
                    <p className="truncate text-[11px] text-fg-subtle">{stripMarkdown(note.content, 70) || 'Empty note'}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No notes yet" description="Notes become your revision material." icon={<IconNote size={20} />} />
          )}
        </SectionCard>
      </div>

      <TaskDialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} task={editingTask} />
      <SessionDialog open={sessionOpen} onClose={() => setSessionOpen(false)} />
      <RevisionDialog open={Boolean(revisionTopic)} onClose={() => setRevisionTopic(null)} topic={revisionTopic} />
    </PageBody>
  );
}

/* ------------------------------- sub-views ------------------------------- */

function TaskRow({ task, onEdit }: { task: StudyTask; onEdit: () => void }) {
  const tone: Tone =
    task.status === 'completed'
      ? 'ok'
      : task.status === 'in-progress'
        ? 'info'
        : task.status === 'skipped'
          ? 'danger'
          : task.priority === 'critical'
            ? 'danger'
            : 'neutral';

  return (
    <li className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong">
      <button
        type="button"
        aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={() => void store.toggleTaskCompleted(task.id)}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          task.status === 'completed' ? 'border-ok bg-ok text-white' : 'border-line-strong text-transparent hover:border-ok',
        )}
      >
        <IconCheck size={12} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[12.5px] font-medium',
            task.status === 'completed' ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {task.title}
        </p>
        {task.notes ? <p className="truncate text-[11px] text-fg-subtle">{task.notes}</p> : null}
      </div>
      <span className="hidden shrink-0 items-center gap-2 sm:flex">
        <Badge tone={tone}>{task.status === 'pending' ? task.priority : task.status}</Badge>
        <span className="font-mono text-[11px] text-fg-subtle">{formatMinutes(task.plannedMinutes)}</span>
      </span>
      <IconButton
        label={`Edit ${task.title}`}
        size="sm"
        icon={<IconCircle size={14} />}
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onEdit}
      />
    </li>
  );
}

function groupBySubject(tasks: StudyTask[]) {
  const map = new Map<string, { subject: string; tasks: StudyTask[]; completedMinutes: number; totalMinutes: number }>();
  for (const task of tasks) {
    const entry = map.get(task.subject) ?? {
      subject: task.subject,
      tasks: [],
      completedMinutes: 0,
      totalMinutes: 0,
    };
    entry.tasks.push(task);
    entry.totalMinutes += task.actualMinutes || task.plannedMinutes;
    if (task.status === 'completed') entry.completedMinutes += task.actualMinutes || task.plannedMinutes;
    map.set(task.subject, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}
