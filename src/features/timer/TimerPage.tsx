import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { TIMER_PRESETS, timerStore, useTimer } from '@/store/timer';
import { STUDY_SUBJECTS } from '@/types';
import { formatClock, formatDate, todayISO } from '@/lib/date';
import { cn, formatMinutes, sum } from '@/lib/utils';
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
} from '@/components/ui/primitives';
import { Field, Input, Select } from '@/components/ui/form';
import { SessionDialog } from '@/features/shared/SessionDialog';
import { FocusMode } from '@/features/timer/FocusMode';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconCheck,
  IconClock,
  IconFlame,
  IconPause,
  IconPlay,
  IconPlus,
  IconReset,
  IconStop,
  IconTarget,
  IconTimer,
  IconTrash,
} from '@/components/icons';

export function TimerPage() {
  const state = useApp();
  const timer = useTimer();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(15);
  // `?focus=1` opens the distraction-free overlay, so any entry point (command
  // palette, dashboard HUD, deep link) can launch it with a plain URL.
  const [focusParam, setFocusParam] = useQueryFlag('focus');
  const handledCompletion = useRef(timer.completionCount);

  const today = todayISO();
  const analytics = useMemo(() => computeAnalytics(state), [state]);
  const todaysSessions = useMemo(() => state.sessions.filter((session) => session.date === today), [state.sessions, today]);
  const minutesToday = sum(todaysSessions.map((session) => session.minutes));

  const progress = timer.totalSeconds ? 1 - timer.remainingSeconds / timer.totalSeconds : 0;
  const percentDone = Math.round(progress * 100);

  // When a session finishes, ask what was studied.
  useEffect(() => {
    if (timer.completionCount !== handledCompletion.current) {
      handledCompletion.current = timer.completionCount;
      setSessionOpen(true);
    }
  }, [timer.completionCount]);

  const subjectsThisWeek = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of state.sessions) {
      map.set(session.subject, (map.get(session.subject) ?? 0) + session.minutes);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [state.sessions]);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Focus timer"
        title="Study timer"
        description="Pomodoro-style focus blocks. When the timer finishes, log what you studied and it feeds your streak and analytics."
        actions={
          <>
            <Button variant="primary" icon={<IconTarget size={15} />} onClick={() => setFocusParam('1')}>
              Focus mode
            </Button>
            <Button variant="secondary" icon={<IconPlus size={15} />} onClick={() => setSessionOpen(true)}>
              Log time manually
            </Button>
          </>
        }
      />

      <FocusMode
        open={focusParam === '1'}
        onClose={() => setFocusParam(undefined)}
        onCompleted={() => setSessionOpen(true)}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="flex flex-col items-center gap-5 py-8 xl:col-span-2">
          <div className="relative">
            <ProgressRing value={percentDone} size={248} strokeWidth={12} tone={timer.status === 'running' ? 'accent' : 'brand'}>
              <span className="font-mono text-[44px] font-semibold leading-none tracking-tight text-fg">
                {formatClock(timer.remainingSeconds)}
              </span>
              <span className="mt-2 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
                {timer.status === 'running'
                  ? 'focusing'
                  : timer.status === 'paused'
                    ? 'paused'
                    : timer.status === 'finished'
                      ? 'session complete'
                      : 'ready'}
              </span>
            </ProgressRing>
            {timer.status === 'running' ? (
              <span className="absolute right-6 top-6 flex h-2.5 w-2.5 animate-pulse-ring rounded-full bg-ok" />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {timer.status === 'running' ? (
              <Button variant="secondary" size="lg" icon={<IconPause size={16} />} onClick={() => timerStore.pause()}>
                Pause
              </Button>
            ) : timer.status === 'paused' ? (
              <Button variant="primary" size="lg" icon={<IconPlay size={16} />} onClick={() => timerStore.resume()}>
                Resume
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                icon={<IconPlay size={16} />}
                onClick={() => timerStore.start({ minutes: timer.totalSeconds / 60, mode: timer.mode })}
              >
                {timer.status === 'finished' ? 'Start another' : 'Start focus'}
              </Button>
            )}
            <Button variant="secondary" size="lg" icon={<IconPlus size={16} />} onClick={() => timerStore.extend(5)}>
              +5 min
            </Button>
            <Button variant="ghost" size="lg" icon={<IconReset size={16} />} onClick={() => timerStore.reset()}>
              Reset
            </Button>
            {timer.status === 'finished' ? (
              <Button variant="ghost" size="lg" icon={<IconCheck size={16} />} onClick={() => timerStore.acknowledge()}>
                Done
              </Button>
            ) : null}
          </div>

          <div className="grid w-full max-w-xl gap-3 px-2 sm:grid-cols-3">
            {TIMER_PRESETS.map((preset) => (
              <button
                key={preset.mode}
                type="button"
                onClick={() =>
                  preset.mode === 'custom'
                    ? timerStore.configure(customMinutes, 'custom')
                    : timerStore.configure(preset.minutes, preset.mode)
                }
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors',
                  timer.mode === preset.mode
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface-2 hover:border-line-strong',
                )}
              >
                <span className={cn('text-[13px] font-semibold', timer.mode === preset.mode ? 'text-brand' : 'text-fg')}>
                  {preset.label}
                </span>
                <span className="text-[10.5px] text-fg-subtle">
                  {preset.mode === 'custom' ? `${customMinutes} min` : `${preset.minutes} minutes`}
                </span>
              </button>
            ))}
          </div>

          <div className="grid w-full max-w-xl gap-3 px-2 sm:grid-cols-3">
            <Field label="Subject">
              <Select
                value={timer.subject}
                onChange={(event) => timerStore.setContext({ subject: event.target.value })}
              >
                {STUDY_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Topic">
              <Input
                value={timer.topic}
                placeholder="Kubernetes Service"
                onChange={(event) => timerStore.setContext({ topic: event.target.value })}
              />
            </Field>
            <Field label="Custom length" hint="Minutes for the Custom preset.">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(Math.max(1, Number(event.target.value)))}
                />
                <Button variant="secondary" onClick={() => timerStore.configure(customMinutes, 'custom')}>
                  Set
                </Button>
              </div>
            </Field>
          </div>

          <p className="max-w-xl px-4 text-center text-[11.5px] text-fg-subtle">
            The timer keeps running if you navigate away or refresh the page — it is restored from local storage on the
            next visit.
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <StatCard
            label="Studied today"
            value={formatMinutes(minutesToday)}
            hint={`${todaysSessions.length} session(s) · target ${formatMinutes(state.settings.dailyStudyTargetMinutes)}`}
            icon={<IconClock size={16} />}
            tone="brand"
            footer={<ProgressBar value={(minutesToday / Math.max(1, state.settings.dailyStudyTargetMinutes)) * 100} />}
          />
          <StatCard
            label="Current streak"
            value={`${analytics.streak.current}d`}
            hint={`Longest ${analytics.streak.longest} days · study once a day to keep it alive`}
            icon={<IconFlame size={16} />}
            tone="warn"
          />

          <SectionCard
            icon={<IconTimer size={15} />}
            title="Today’s sessions"
            subtitle={todaysSessions.length ? `${formatMinutes(minutesToday)} logged` : 'Nothing logged yet'}
            bodyClassName="px-4 py-4"
          >
            {todaysSessions.length ? (
              <ul className="flex flex-col gap-2">
                {todaysSessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                      <IconTimer size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-fg">{session.topic || session.subject}</p>
                      <p className="truncate text-[10.5px] text-fg-subtle">
                        {session.subject} · {formatDate(session.date, 'short')}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-fg-muted">{session.minutes}m</span>
                    <IconButton
                      label="Delete session"
                      size="sm"
                      icon={<IconTrash size={12} />}
                      onClick={() => void store.deleteSession(session.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<IconTimer size={20} />}
                title="No sessions today"
                description="A single 25-minute block is enough to keep a streak alive."
              />
            )}
          </SectionCard>

          <SectionCard
            icon={<IconCheck size={15} />}
            title="Where your hours go"
            subtitle="All-time minutes by subject"
            bodyClassName="px-5 py-4"
          >
            {subjectsThisWeek.length ? (
              <ul className="flex flex-col gap-3">
                {subjectsThisWeek.map(([subject, minutes]) => {
                  const total = sum(subjectsThisWeek.map(([, value]) => value));
                  return (
                    <li key={subject}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-fg">{subject}</span>
                        <span className="font-mono text-fg-muted">{formatMinutes(minutes)}</span>
                      </div>
                      <ProgressBar value={(minutes / Math.max(1, total)) * 100} className="mt-1.5" height={5} tone="accent" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[12.5px] text-fg-muted">Log a session to see the split.</p>
            )}
          </SectionCard>

          <Card className="flex flex-col gap-2">
            <Badge tone="brand" dot>
              Focus tips
            </Badge>
            <ul className="flex flex-col gap-1.5 text-[12px] text-fg-muted">
              <li>• 25 minutes of hands-on practice beats 2 hours of watching.</li>
              <li>• After each block, write one line in a note about what confused you.</li>
              <li>• If a block ends mid-task, do not extend — log it and continue after a break.</li>
            </ul>
            {timer.status === 'running' ? (
              <Button variant="ghost" size="sm" icon={<IconStop size={13} />} onClick={() => timerStore.reset()}>
                Abandon this block
              </Button>
            ) : null}
          </Card>
        </div>
      </div>

      <SessionDialog
        open={sessionOpen}
        onClose={() => {
          setSessionOpen(false);
          timerStore.acknowledge();
        }}
        title="What did you study?"
        description="This gets added to your streak, daily target and analytics."
        defaults={{
          minutes: timerStore.elapsedMinutes(),
          subject: timer.subject,
          topic: timer.topic,
          mode: timer.mode,
        }}
      />
    </PageBody>
  );
}
