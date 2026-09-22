import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { computeAchievements, rememberAchievements, type Achievement, type AchievementIcon } from '@/lib/achievements';
import { timerStore } from '@/store/timer';
import { todayISO } from '@/lib/date';
import { cn, formatMinutes } from '@/lib/utils';
import { Badge, Button, ProgressBar } from '@/components/ui/primitives';
import { ConfettiBurst, CountUp, HudRing, LiveClock } from '@/components/effects';
import {
  IconBook,
  IconBrain,
  IconCheck,
  IconFlame,
  IconNote,
  IconPlay,
  IconRocket,
  IconStar,
  IconTarget,
  IconTimer,
  IconTrendingUp,
  IconZap,
} from '@/components/icons';

const ACHIEVEMENT_ICONS: Record<AchievementIcon, (props: { size?: number; className?: string }) => ReactNode> = {
  flame: IconFlame,
  target: IconTarget,
  book: IconBook,
  rocket: IconRocket,
  note: IconNote,
  zap: IconZap,
  star: IconStar,
  brain: IconBrain,
  timer: IconTimer,
  trend: IconTrendingUp,
};

/**
 * Mission Control — the flagship band at the top of the dashboard.
 *
 * Answers the three questions that matter the moment the app opens: where am I,
 * what is next, and how much momentum do I have? Everything is derived from the
 * existing analytics, so it can never disagree with the rest of the app.
 */
export function MissionControl() {
  const state = useApp();
  const navigate = useNavigate();
  const analytics = useMemo(() => computeAnalytics(state), [state]);
  const achievements = useMemo(() => computeAchievements(state, analytics), [state, analytics]);

  const [fireKey, setFireKey] = useState(0);
  const celebratedRef = useRef(false);

  const nextTask = useMemo(() => {
    const openToday = analytics.today.tasks.find((task) => task.status === 'pending' || task.status === 'in-progress');
    if (openToday) return openToday;
    const today = todayISO();
    return (
      [...state.tasks]
        .filter((task) => task.status === 'pending' && task.date > today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    );
  }, [analytics.today.tasks, state.tasks]);

  // Celebrate achievements unlocked since the last visit (once per session).
  useEffect(() => {
    if (celebratedRef.current) return;
    celebratedRef.current = true;

    const { newlyEarned } = rememberAchievements(achievements);
    if (!newlyEarned.length) return;

    setFireKey((key) => key + 1);
    for (const achievement of newlyEarned.slice(0, 3)) {
      store.toast({
        title: `🏆 Achievement unlocked — ${achievement.title}`,
        message: achievement.description,
        tone: 'ok',
        duration: 6000,
      });
    }
  }, [achievements]);

  const earnedCount = achievements.filter((entry) => entry.earned).length;
  const todayPercent = analytics.todayProgress;
  const daysLeft = analytics.daysUntilTarget;

  const startFocus = () => {
    const minutes = nextTask?.plannedMinutes ?? 25;
    timerStore.setContext({ subject: nextTask?.subject ?? '', topic: nextTask?.topic ?? '' });
    timerStore.start({ minutes: minutes > 0 ? minutes : 25, subject: nextTask?.subject, topic: nextTask?.topic });
    store.toast({
      title: `Focus session started — ${minutes} min`,
      message: nextTask ? nextTask.title : 'Free study block',
      tone: 'info',
    });
    navigate('/timer');
  };

  const completeNext = async () => {
    if (!nextTask) return;
    await store.toggleTaskCompleted(nextTask.id);
    setFireKey((key) => key + 1);
  };

  return (
    <section id="mission-control" className="hud-panel relative animate-hud-in">
      <ConfettiBurst fireKey={fireKey} />

      <div className="hud-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <div className="relative flex flex-col gap-5 p-4 sm:p-5">
        {/* ------------------------------ live state ---------------------------- */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono">
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-ok" />
            mission control
          </span>
          <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1">
            <LiveClock showDate />
          </span>
          <Badge tone={analytics.streak.current > 0 ? 'warn' : 'neutral'}>
            <span className="inline-flex items-center gap-1">
              <IconFlame size={11} />
              {analytics.streak.current}-day streak
            </span>
          </Badge>
          {daysLeft !== null ? (
            <Badge tone={daysLeft >= 0 ? 'brand' : 'danger'}>
              {daysLeft >= 0 ? `${daysLeft} days to target` : `${Math.abs(daysLeft)} days past target`}
            </Badge>
          ) : null}
          <span className="ml-auto hidden sm:inline">
            {earnedCount}/{achievements.length} achievements · {analytics.consistency}% consistent
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          {/* ------------------------------- the ring --------------------------- */}
          <div className="flex items-center gap-5">
            <HudRing value={analytics.overall} size={148} thickness={11}>
              <CountUp value={analytics.overall} suffix="%" className="font-mono text-3xl font-semibold text-fg" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-fg-subtle">mastery</span>
              <span className="mt-0.5 text-[10.5px] text-fg-muted">topics · courses · projects</span>
            </HudRing>

            <div className="flex min-w-0 flex-col gap-2">
              <Momentum label="Today" value={analytics.minutesToday} target={analytics.targetToday} percent={todayPercent} />
              <Momentum label="This week" value={analytics.minutesThisWeek} target={analytics.weekTarget} percent={analytics.weekProgress} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-fg-subtle">
                <span>
                  <CountUp value={analytics.minutesTotal / 60} decimals={1} suffix="h" className="text-fg" /> total
                </span>
                <span>
                  <CountUp value={analytics.overallTaskStats.completed} className="text-fg" />/{analytics.overallTaskStats.total} tasks
                </span>
                <span>
                  <CountUp value={analytics.notesCount} className="text-fg" /> notes
                </span>
              </div>
            </div>
          </div>

          {/* -------------------------------- next up -------------------------- */}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">Next up</span>
              {nextTask ? (
                <span className="font-mono text-[11px] text-fg-subtle">
                  {nextTask.date} · {nextTask.priority}
                </span>
              ) : null}
            </div>

            {nextTask ? (
              <>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-fg">{nextTask.title}</p>
                  <p className="mt-0.5 text-[12px] text-fg-muted">
                    {nextTask.subject}
                    {nextTask.topic ? ` · ${nextTask.topic}` : ''} · {formatMinutes(nextTask.plannedMinutes)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" icon={<IconPlay size={14} />} onClick={startFocus}>
                    Start focus
                  </Button>
                  <Button variant="secondary" size="sm" icon={<IconCheck size={14} />} onClick={() => void completeNext()}>
                    Mark done
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/planner')}>
                    Open planner
                  </Button>
                </div>
                {analytics.focusSuggestion ? (
                  <p className="text-[11.5px] text-fg-subtle">
                    Suggested block: {analytics.focusSuggestion.reason}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-fg">Nothing scheduled — you are ahead 🎉</p>
                <p className="text-[12px] text-fg-muted">
                  Add a task for today, or start a free 25-minute focus block and log it afterwards.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" icon={<IconPlay size={14} />} onClick={startFocus}>
                    Start 25-minute focus
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/planner?new=task')}>
                    Plan a task
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ------------------------------ achievements ------------------------- */}
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              Achievements
            </span>
            <span className="font-mono text-[11px] text-fg-subtle">
              {earnedCount}/{achievements.length} unlocked
            </span>
          </div>

          <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="snap-start">
                <AchievementChip achievement={achievement} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Momentum({ label, value, target, percent }: { label: string; value: number; target: number; percent: number }) {
  return (
    <div className="min-w-44">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-fg-subtle">{label}</span>
        <span className="font-mono text-fg-muted">
          {Math.round(value)}/{Math.round(target)} min
        </span>
      </div>
      <ProgressBar value={percent} className="mt-1.5" height={5} />
    </div>
  );
}

function AchievementChip({ achievement }: { achievement: Achievement }) {
  const Icon = ACHIEVEMENT_ICONS[achievement.icon] ?? IconStar;

  const chip = (
    <button
      type="button"
      aria-label={`${achievement.title} — ${achievement.earned ? 'unlocked' : 'locked'}`}
      onClick={() =>
        store.toast({
          title: `${achievement.earned ? '🏆' : '🔒'} ${achievement.title}`,
          message: `${achievement.description} (${achievement.value})`,
          tone: achievement.earned ? 'ok' : 'info',
        })
      }
      className={cn(
        'flex w-36 flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all sm:w-40',
        achievement.earned
          ? 'border-brand/40 bg-gradient-to-br from-brand-soft to-transparent hover:border-brand'
          : 'border-line bg-surface-2 opacity-70 hover:opacity-100',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-lg',
            achievement.earned ? 'bg-brand text-brand-fg' : 'bg-surface-3 text-fg-subtle',
          )}
        >
          <Icon size={13} />
        </span>
        <span className="truncate text-[12px] font-semibold text-fg">{achievement.title}</span>
      </span>
      <span className="w-full truncate font-mono text-[10.5px] text-fg-subtle">{achievement.value}</span>
      {achievement.earned ? null : <ProgressBar value={achievement.progress * 100} height={3} />}
    </button>
  );

  return chip;
}
