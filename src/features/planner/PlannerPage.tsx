import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { buildDayPlan } from '@/lib/progress';
import { addDays, dayLabel, formatDate, rangeOfDays, startOfWeek, todayISO } from '@/lib/date';
import { cn, formatMinutes, percent, sum } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar, ProgressRing, SectionCard, Segmented } from '@/components/ui/primitives';
import { TaskDialog } from '@/features/shared/TaskDialog';
import { SessionDialog } from '@/features/shared/SessionDialog';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconPencil,
  IconPlus,
  IconTarget,
  IconTimer,
  IconTrash,
} from '@/components/icons';
import type { StudyTask, TaskStatus } from '@/types';
import { TASK_STATUS_META } from '@/types';

type RangeView = 'day' | 'week';

export function PlannerPage() {
  const state = useApp();
  const navigate = useNavigate();
  const analytics = useMemo(() => computeAnalytics(state), [state]);

  const [date, setDate] = useState(todayISO());
  const [view, setView] = useState<RangeView>('day');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StudyTask | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);

  const [newParam, setNewParam] = useQueryFlag('new');
  const [dateParam, setDateParam] = useQueryFlag('date');
  const [focusParam, setFocusParam] = useQueryFlag('focus');

  // Deep links: ?date=2026-09-22&new=task
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setDate(dateParam);
      setDateParam(undefined);
    }
  }, [dateParam, setDateParam]);

  useEffect(() => {
    if (newParam === 'task') {
      setEditing(null);
      setDialogOpen(true);
      setNewParam(undefined);
    }
  }, [newParam, setNewParam]);

  useEffect(() => {
    if (!focusParam) return;
    const element = document.querySelector(`[data-task-id="${focusParam}"]`);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = setTimeout(() => setFocusParam(undefined), 1_500);
    return () => clearTimeout(timer);
  }, [focusParam, setFocusParam]);

  const weekStart = startOfWeek(date, state.settings.weekStartsOn);
  const weekDays = rangeOfDays(weekStart, addDays(weekStart, 6));

  const dayPlan = useMemo(
    () => buildDayPlan(date, state.tasks, state.settings.dailyStudyTargetMinutes),
    [date, state.tasks, state.settings.dailyStudyTargetMinutes],
  );

  const weekPlan = useMemo(() => {
    const tasks = state.tasks.filter((task) => task.date >= weekStart && task.date <= addDays(weekStart, 6));
    return {
      tasks,
      planned: sum(tasks.map((task) => task.plannedMinutes)),
      completed: sum(
        tasks.filter((task) => task.status === 'completed').map((task) => task.actualMinutes || task.plannedMinutes),
      ),
    };
  }, [state.tasks, weekStart]);

  const daySessions = state.sessions.filter((session) => session.date === date);

  const subjects = useMemo(() => groupSubjects(dayPlan.tasks), [dayPlan.tasks]);

  const openNew = (subject?: string) => {
    setEditing(null);
    if (subject) setPresetSubject(subject);
    setDialogOpen(true);
  };
  const [presetSubject, setPresetSubject] = useState<string | undefined>(undefined);

  const deleteTask = (task: StudyTask) => {
    store.requestConfirmation({
      title: 'Delete task?',
      message: `“${task.title}” will be permanently removed from your planner.`,
      confirmLabel: 'Delete task',
      tone: 'danger',
      onConfirm: async () => {
        await store.deleteTask(task.id);
        store.toast({ title: 'Task deleted', tone: 'info' });
      },
    });
  };

  const isToday = date === todayISO();

  return (
    <PageBody>
      <PageHeader
        eyebrow="Daily planner"
        title={formatDate(date, 'long')}
        description={
          isToday
            ? 'Your plan for today. Completing tasks keeps the streak alive.'
            : `You are viewing ${formatDate(date, 'medium')}. Switch back to today with the button on the right.`
        }
        actions={
          <>
            {!isToday ? (
              <Button variant="secondary" onClick={() => setDate(todayISO())}>
                Jump to today
              </Button>
            ) : null}
            <Button variant="secondary" icon={<IconClock size={15} />} onClick={() => setSessionOpen(true)}>
              Log time
            </Button>
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => openNew()}>
              Add task
            </Button>
          </>
        }
      />

      {/* ------------------------------ week strip ---------------------------- */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <IconButton
              label="Previous week"
              variant="secondary"
              size="sm"
              icon={<ChevronLeft />}
              onClick={() => setDate(addDays(date, -7))}
            />
            <span className="text-[12.5px] font-medium text-fg">
              {formatDate(weekStart, 'short')} – {formatDate(addDays(weekStart, 6), 'short')}
            </span>
            <IconButton
              label="Next week"
              variant="secondary"
              size="sm"
              icon={<ChevronRight />}
              onClick={() => setDate(addDays(date, 7))}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11.5px] text-fg-subtle sm:inline">
              {formatMinutes(weekPlan.completed)} / {formatMinutes(weekPlan.planned)} this week
            </span>
            <Segmented
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
              ]}
              value={view}
              onChange={setView}
              size="sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-7 divide-x divide-line">
          {weekDays.map((day) => {
            const tasks = state.tasks.filter((task) => task.date === day);
            const completed = tasks.filter((task) => task.status === 'completed').length;
            const active = day === date;
            const today = day === todayISO();
            return (
              <button
                key={day}
                type="button"
                onClick={() => setDate(day)}
                className={cn(
                  'flex flex-col items-center gap-1.5 px-2 py-3 transition-colors',
                  active ? 'bg-brand-soft' : 'hover:bg-surface-3',
                )}
              >
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider', today ? 'text-brand' : 'text-fg-subtle')}>
                  {dayLabel(day)}
                </span>
                <span className={cn('font-mono text-[15px] font-semibold', active ? 'text-brand' : 'text-fg')}>
                  {Number(day.slice(8))}
                </span>
                <span className="flex items-center gap-1">
                  {tasks.length ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-surface-3" />
                      <span className="font-mono text-[9.5px] text-fg-subtle">
                        {completed}/{tasks.length}
                      </span>
                    </>
                  ) : (
                    <span className="text-[9.5px] text-fg-subtle">—</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {view === 'week' ? (
        <WeekGrid tasks={state.tasks} weekDays={weekDays} onSelectDay={(day) => { setDate(day); setView('day'); }} />
      ) : (
        <>
          {/* ------------------------------ day budget ------------------------ */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex items-center gap-5 lg:col-span-2">
              <ProgressRing value={percent(dayPlan.completedMinutes, Math.max(1, dayPlan.targetMinutes))} size={96} strokeWidth={9}>
                <span className="font-mono text-lg font-semibold text-fg">
                  {percent(dayPlan.completedMinutes, Math.max(1, dayPlan.targetMinutes))}%
                </span>
                <span className="text-[9.5px] uppercase tracking-wider text-fg-subtle">target</span>
              </ProgressRing>
              <div className="grid flex-1 grid-cols-3 gap-3">
                <Budget label="Target" value={formatMinutes(dayPlan.targetMinutes)} tone="neutral" />
                <Budget label="Completed" value={formatMinutes(dayPlan.completedMinutes)} tone="ok" />
                <Budget label="Remaining" value={formatMinutes(dayPlan.remainingMinutes)} tone="warn" />
              </div>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Day stats</span>
                <Badge tone={dayPlan.stats.completionRate >= 100 ? 'ok' : 'brand'}>
                  {dayPlan.stats.completionRate}% done
                </Badge>
              </div>
              <ul className="flex flex-col gap-1.5 text-[12.5px]">
                <StatLine label="Tasks planned" value={`${dayPlan.tasks.length}`} />
                <StatLine label="Completed" value={`${dayPlan.stats.completed}`} tone="ok" />
                <StatLine label="Pending" value={`${dayPlan.stats.pending}`} />
                <StatLine label="In progress" value={`${dayPlan.stats.inProgress}`} tone="info" />
                <StatLine label="Skipped" value={`${dayPlan.stats.skipped}`} tone="danger" />
              </ul>
              <Button
                variant="secondary"
                size="sm"
                icon={<IconTimer size={14} />}
                onClick={() => navigate('/timer')}
                className="mt-auto"
              >
                Start a focus block
              </Button>
            </Card>
          </div>

          {/* -------------------------------- tasks --------------------------- */}
          {subjects.length ? (
            <div className="flex flex-col gap-4">
              {subjects.map((subject) => (
                <SectionCard
                  key={subject.name}
                  icon={<IconTarget size={15} />}
                  title={subject.name}
                  subtitle={`${subject.tasks.length} task(s) · ${formatMinutes(subject.completedMinutes)} of ${formatMinutes(
                    subject.plannedMinutes,
                  )}`}
                  action={
                    <Button size="sm" variant="ghost" icon={<IconPlus size={13} />} onClick={() => openNew(subject.name)}>
                      Add
                    </Button>
                  }
                  bodyClassName="px-4 py-4"
                >
                  {subject.plannedMinutes > 0 && subject.plannedMinutes !== dayPlan.targetMinutes ? (
                    <ProgressBar
                      value={percent(subject.completedMinutes, subject.plannedMinutes)}
                      height={4}
                      className="mb-3"
                    />
                  ) : null}
                  <ul className="flex flex-col gap-1.5">
                    {subject.tasks.map((task) => (
                      <PlannerTaskRow
                        key={task.id}
                        task={task}
                        highlighted={task.id === focusParam}
                        onEdit={() => {
                          setEditing(task);
                          setDialogOpen(true);
                        }}
                        onDelete={() => deleteTask(task)}
                        onLog={() => setSessionOpen(true)}
                      />
                    ))}
                  </ul>
                </SectionCard>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<IconCalendar size={20} />}
                title={`Nothing planned for ${formatDate(date, 'short')}`}
                description="Build a realistic day: 2–3 hour-long blocks beats one heroic 8-hour session."
                action={
                  <>
                    <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => openNew()}>
                      Add the first task
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<IconTarget size={15} />}
                      onClick={() => {
                        const pending = analytics.today.tasks.filter((task) => task.status === 'pending');
                        if (!dayPlan.tasks.length && pending.length) {
                          setDate(todayISO());
                          store.toast({ title: 'Switched to today', message: 'Your planned tasks are on today’s date.', tone: 'info' });
                        } else {
                          navigate('/assistant');
                        }
                      }}
                    >
                      Get a suggested plan
                    </Button>
                  </>
                }
              />
            </Card>
          )}

          {/* ------------------------------ sessions -------------------------- */}
          <SectionCard
            icon={<IconClock size={15} />}
            title="Study sessions logged"
            subtitle={daySessions.length ? `${formatMinutes(sum(daySessions.map((s) => s.minutes)))} across ${daySessions.length} session(s)` : 'No sessions logged for this day'}
            action={
              <Button size="sm" variant="secondary" icon={<IconPlus size={13} />} onClick={() => setSessionOpen(true)}>
                Log
              </Button>
            }
            bodyClassName="px-5 py-4"
          >
            {daySessions.length ? (
              <ul className="flex flex-col gap-2">
                {daySessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                      <IconTimer size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-fg">
                        {session.topic || session.subject}
                      </p>
                      <p className="truncate text-[11px] text-fg-subtle">
                        {session.subject} · {session.mode.replace('-', ' ')}
                        {session.notes ? ` · ${session.notes}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-[11.5px] text-fg-muted">{formatMinutes(session.minutes)}</span>
                    <IconButton
                      label="Delete session"
                      size="sm"
                      icon={<IconTrash size={13} />}
                      onClick={() =>
                        store.requestConfirmation({
                          title: 'Delete session?',
                          message: `Remove ${formatMinutes(session.minutes)} of study time from ${formatDate(session.date, 'short')}?`,
                          confirmLabel: 'Delete',
                          tone: 'danger',
                          onConfirm: async () => {
                            await store.deleteSession(session.id);
                          },
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-fg-muted">
                Sessions you log here feed the daily target, streak and analytics.
              </p>
            )}
          </SectionCard>
        </>
      )}

      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setPresetSubject(undefined);
        }}
        task={editing}
        defaults={{ date, subject: presetSubject ?? 'DevOps' }}
      />
      <SessionDialog open={sessionOpen} onClose={() => setSessionOpen(false)} defaults={{ subject: subjects[0]?.name ?? 'DevOps' }} />
    </PageBody>
  );
}

/* ------------------------------- sub-views ------------------------------- */

function Budget({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-fg';
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-3 text-center">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className={cn('mt-1 font-mono text-lg font-semibold', toneClass)}>{value}</p>
    </div>
  );
}

function StatLine({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'info' | 'danger' }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span
        className={cn(
          'font-mono text-[12px] font-semibold',
          tone === 'ok' ? 'text-ok' : tone === 'info' ? 'text-info' : tone === 'danger' ? 'text-danger' : 'text-fg',
        )}
      >
        {value}
      </span>
    </li>
  );
}

function PlannerTaskRow({
  task,
  highlighted,
  onEdit,
  onDelete,
  onLog,
}: {
  task: StudyTask;
  highlighted: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLog: () => void;
}) {
  const meta = TASK_STATUS_META.find((entry) => entry.value === task.status);
  return (
    <li
      data-task-id={task.id}
      className={cn(
        'group flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
        highlighted ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
    >
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
            'truncate text-[13px] font-medium',
            task.status === 'completed' ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {task.title}
        </p>
        <p className="truncate text-[11px] text-fg-subtle">
          {task.topic !== task.subject ? `${task.topic} · ` : ''}
          planned {formatMinutes(task.plannedMinutes)}
          {task.actualMinutes ? ` · actual ${formatMinutes(task.actualMinutes)}` : ''}
          {task.notes ? ` · ${task.notes}` : ''}
        </p>
      </div>

      <select
        value={task.status}
        onChange={(event) => void store.updateTask(task.id, { status: event.target.value as TaskStatus })}
        aria-label={`Status for ${task.title}`}
        className={cn(
          'h-7 shrink-0 cursor-pointer rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold focus:outline-none',
          meta?.tone === 'ok' ? 'text-ok' : meta?.tone === 'info' ? 'text-info' : meta?.tone === 'danger' ? 'text-danger' : 'text-fg-muted',
        )}
      >
        {TASK_STATUS_META.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>

      <Badge tone={task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warn' : 'neutral'}>
        {task.priority}
      </Badge>

      <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton label="Log study time" size="sm" icon={<IconTimer size={13} />} onClick={onLog} />
        <IconButton label={`Edit ${task.title}`} size="sm" icon={<IconPencil size={13} />} onClick={onEdit} />
        <IconButton label={`Delete ${task.title}`} size="sm" icon={<IconTrash size={13} />} onClick={onDelete} />
      </span>
    </li>
  );
}

function WeekGrid({
  tasks,
  weekDays,
  onSelectDay,
}: {
  tasks: StudyTask[];
  weekDays: string[];
  onSelectDay: (day: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {weekDays.map((day) => {
        const dayTasks = tasks.filter((task) => task.date === day);
        const plan = buildDayPlan(day, tasks, 240);
        return (
          <SectionCard
            key={day}
            title={formatDate(day, 'day')}
            subtitle={`${dayTasks.length} task(s) · ${formatMinutes(plan.completedMinutes)}/${formatMinutes(
              plan.plannedMinutes,
            )}`}
            action={
              <Button size="sm" variant="ghost" onClick={() => onSelectDay(day)}>
                Open
              </Button>
            }
            bodyClassName="px-4 py-3"
          >
            {dayTasks.length ? (
              <ul className="flex flex-col gap-1.5">
                {dayTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        task.status === 'completed' ? 'bg-ok' : task.status === 'skipped' ? 'bg-danger' : 'bg-fg-subtle',
                      )}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[12px]',
                        task.status === 'completed' ? 'text-fg-subtle line-through' : 'text-fg-muted',
                      )}
                    >
                      {task.title}
                    </span>
                    <span className="font-mono text-[10px] text-fg-subtle">{task.plannedMinutes}m</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11.5px] text-fg-subtle">Free day — nothing scheduled.</p>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

function groupSubjects(tasks: StudyTask[]) {
  const map = new Map<
    string,
    { name: string; tasks: StudyTask[]; plannedMinutes: number; completedMinutes: number }
  >();
  for (const task of tasks) {
    const entry = map.get(task.subject) ?? { name: task.subject, tasks: [], plannedMinutes: 0, completedMinutes: 0 };
    entry.tasks.push(task);
    entry.plannedMinutes += task.plannedMinutes;
    if (task.status === 'completed') entry.completedMinutes += task.actualMinutes || task.plannedMinutes;
    map.set(task.subject, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.plannedMinutes - a.plannedMinutes);
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
