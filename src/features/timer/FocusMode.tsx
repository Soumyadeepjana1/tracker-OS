import { useEffect, useMemo, type ReactNode } from 'react';
import { useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { timerStore, useTimer } from '@/store/timer';
import { formatClock } from '@/lib/date';
import { formatMinutes } from '@/lib/utils';
import { Badge, Button, IconButton } from '@/components/ui/primitives';
import { AuroraBackground, CountUp, EnergyBar, HudRing } from '@/components/effects';
import {
  IconCheck,
  IconClose,
  IconFlame,
  IconPause,
  IconPlay,
  IconPlus,
  IconReset,
  IconTarget,
  IconTimer,
} from '@/components/icons';

/**
 * Distraction-free focus mode.
 *
 * A full-screen HUD around the existing pomodoro store — the timer keeps
 * running while you are here (and while you are anywhere else in the app), and
 * closing the overlay never loses the session.
 *
 * Keyboard: `Space` start/pause · `E` +5 min · `Esc` exit.
 */
export function FocusMode({
  open,
  onClose,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  /** Called when a session finishes, so the caller can open the log dialog. */
  onCompleted: () => void;
}) {
  const state = useApp();
  const timer = useTimer();
  const analytics = useMemo(() => computeAnalytics(state), [state]);

  const progress = timer.totalSeconds ? 1 - timer.remainingSeconds / timer.totalSeconds : 0;
  const isRunning = timer.status === 'running';
  const isFinished = timer.status === 'finished';

  // Keyboard shortcuts.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        if (isRunning) timerStore.pause();
        else if (timer.status === 'paused') timerStore.resume();
        else timerStore.start();
        return;
      }
      if (event.key.toLowerCase() === 'e') timerStore.extend(5);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isRunning, timer.status, onClose]);

  // Lock background scrolling while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // A finished session asks what was studied, then closes the overlay.
  useEffect(() => {
    if (open && isFinished) {
      onCompleted();
      onClose();
    }
  }, [open, isFinished, onCompleted, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-canvas/95 backdrop-blur-2xl">
      <AuroraBackground />

      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-fg-subtle">
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-ok" />
            focus mode
          </span>
          <Badge tone="brand">
            <span className="inline-flex items-center gap-1">
              <IconTimer size={11} />
              {timer.mode}
            </span>
          </Badge>
          <span className="truncate text-[12.5px] text-fg-muted">
            {timer.subject}
            {timer.topic ? ` · ${timer.topic}` : ''}
          </span>
        </div>
        <IconButton label="Exit focus mode (Esc)" icon={<IconClose size={16} />} onClick={onClose} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-10 sm:gap-8">
        <div className="scale-90 sm:scale-100">
          <HudRing value={progress * 100} size={320} thickness={16}>
            <span className="font-mono text-[64px] font-semibold leading-none tracking-tight text-fg sm:text-[76px]">
              {formatClock(timer.remainingSeconds)}
            </span>
            <span className="mt-2 text-[11px] uppercase tracking-[0.24em] text-fg-subtle">
              {isRunning ? 'in flow' : isFinished ? 'complete' : timer.status === 'paused' ? 'paused' : 'ready'}
            </span>
            <span className="mt-1 font-mono text-[12px] text-fg-muted">
              {Math.round(progress * 100)}% · <CountUp value={analytics.minutesToday} /> min today
            </span>
          </HudRing>
        </div>

        <EnergyBar className="max-w-xl" />

        <div className="flex flex-wrap items-center justify-center gap-2">
          {isRunning ? (
            <Button variant="secondary" size="lg" icon={<IconPause size={16} />} onClick={() => timerStore.pause()}>
              Pause
            </Button>
          ) : timer.status === 'paused' ? (
            <Button variant="primary" size="lg" icon={<IconPlay size={16} />} onClick={() => timerStore.resume()}>
              Resume
            </Button>
          ) : (
            <Button variant="primary" size="lg" icon={<IconPlay size={16} />} onClick={() => timerStore.start()}>
              Start {Math.round(timer.totalSeconds / 60)} min
            </Button>
          )}

          <Button variant="secondary" size="lg" icon={<IconPlus size={16} />} onClick={() => timerStore.extend(5)}>
            +5 min
          </Button>
          <Button variant="ghost" size="lg" icon={<IconReset size={16} />} onClick={() => timerStore.reset()}>
            Reset
          </Button>
          <Button
            variant="ghost"
            size="lg"
            icon={<IconCheck size={16} />}
            onClick={() => {
              if (timerStore.elapsedMinutes() >= 1) onCompleted();
              timerStore.reset();
              onClose();
            }}
          >
            Finish &amp; log
          </Button>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          <FocusStat label="Focus time today" value={formatMinutes(analytics.minutesToday)} icon={<IconTimer size={14} />} />
          <FocusStat
            label="Current streak"
            value={`${analytics.streak.current} days`}
            icon={<IconFlame size={14} />}
            tone="warn"
          />
          <FocusStat
            label="Today's target"
            value={`${analytics.todayProgress}% of ${formatMinutes(analytics.targetToday)}`}
            icon={<IconTarget size={14} />}
            tone="ok"
          />
        </div>

        <p className="font-mono text-[11px] text-fg-subtle">
          space start/pause · e +5 min · esc exit — the timer keeps running wherever you go
        </p>
      </main>
    </div>
  );
}

function FocusStat({
  label,
  value,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'brand' | 'warn' | 'ok';
}) {
  const toneClass: Record<string, string> = {
    brand: 'bg-brand-soft text-brand',
    warn: 'bg-warn-soft text-warn',
    ok: 'bg-ok-soft text-ok',
  };

  return (
    <div className="rounded-2xl border border-line bg-surface-2/70 p-3.5">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClass[tone]}`}>{icon}</span>
      <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[13.5px] font-semibold text-fg">{value}</p>
    </div>
  );
}
