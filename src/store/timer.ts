import { useSyncExternalStore } from 'react';
import type { TimerMode } from '@/types';
import { TIMER_STORAGE_KEY } from './defaults';

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerState {
  status: TimerStatus;
  mode: TimerMode;
  /** Configured length of the current session. */
  totalSeconds: number;
  remainingSeconds: number;
  /** Epoch ms when the running session should complete (null when not running). */
  endsAt: number | null;
  subject: string;
  topic: string;
  startedAt: string | null;
  /** Increments each time a session completes, so views can react once. */
  completionCount: number;
}

export const TIMER_PRESETS: { mode: TimerMode; label: string; minutes: number; description: string }[] = [
  { mode: 'pomodoro-25', label: 'Focus 25', minutes: 25, description: 'Classic pomodoro — deep work with a 5 min break.' },
  { mode: 'pomodoro-50', label: 'Deep 50', minutes: 50, description: 'Longer block for labs and hands-on practice.' },
  { mode: 'custom', label: 'Custom', minutes: 15, description: 'Any length you need.' },
];

const IDLE_STATE: TimerState = {
  status: 'idle',
  mode: 'pomodoro-25',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  endsAt: null,
  subject: 'DevOps',
  topic: '',
  startedAt: null,
  completionCount: 0,
};

class TimerStore {
  private state: TimerState = { ...IDLE_STATE };
  private listeners = new Set<() => void>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private loaded = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): TimerState => this.state;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private set(patch: Partial<TimerState>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    this.emit();
  }

  private persist(): void {
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage may be unavailable — the timer still works in-memory */
    }
  }

  /** Restores an in-flight timer after a page refresh. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TimerState>;
      const totalSeconds = typeof parsed.totalSeconds === 'number' && parsed.totalSeconds > 0 ? parsed.totalSeconds : 25 * 60;
      const restored: TimerState = {
        ...IDLE_STATE,
        ...parsed,
        totalSeconds,
        remainingSeconds: Math.max(0, Math.min(totalSeconds, parsed.remainingSeconds ?? totalSeconds)),
      };

      if (restored.status === 'running' && restored.endsAt) {
        const remaining = Math.round((restored.endsAt - Date.now()) / 1000);
        if (remaining <= 0) {
          this.state = { ...restored, status: 'finished', remainingSeconds: 0, endsAt: null };
        } else {
          this.state = { ...restored, remainingSeconds: remaining };
          this.startTicking();
        }
      } else {
        this.state = restored;
      }
      this.emit();
    } catch (error) {
      console.warn('[devops-os] could not restore the timer', error);
    }
  }

  private startTicking(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), 500);
  }

  private stopTicking(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    if (this.state.status !== 'running' || !this.state.endsAt) return;
    const remaining = Math.max(0, Math.round((this.state.endsAt - Date.now()) / 1000));
    if (remaining <= 0) {
      this.stopTicking();
      this.set({
        status: 'finished',
        remainingSeconds: 0,
        endsAt: null,
        completionCount: this.state.completionCount + 1,
      });
      return;
    }
    if (remaining !== this.state.remainingSeconds) this.set({ remainingSeconds: remaining });
  }

  configure(minutes: number, mode: TimerMode): void {
    if (this.state.status === 'running') return;
    const totalSeconds = Math.max(60, Math.round(minutes * 60));
    this.set({
      mode,
      totalSeconds,
      remainingSeconds: totalSeconds,
      status: 'idle',
      endsAt: null,
    });
  }

  start(options: { minutes?: number; mode?: TimerMode; subject?: string; topic?: string } = {}): void {
    const minutes = options.minutes ?? this.state.totalSeconds / 60;
    const totalSeconds = Math.max(60, Math.round(minutes * 60));
    this.set({
      status: 'running',
      mode: options.mode ?? this.state.mode,
      totalSeconds,
      remainingSeconds: totalSeconds,
      endsAt: Date.now() + totalSeconds * 1000,
      subject: options.subject ?? this.state.subject,
      topic: options.topic ?? this.state.topic,
      startedAt: this.state.startedAt ?? new Date().toISOString(),
    });
    this.startTicking();
  }

  pause(): void {
    if (this.state.status !== 'running') return;
    this.stopTicking();
    this.set({ status: 'paused', endsAt: null });
  }

  resume(): void {
    if (this.state.status !== 'paused') return;
    this.set({ status: 'running', endsAt: Date.now() + this.state.remainingSeconds * 1000 });
    this.startTicking();
  }

  /** Adds five minutes to a paused or running session. */
  extend(minutes = 5): void {
    const extra = minutes * 60;
    if (this.state.status === 'running' && this.state.endsAt) {
      this.set({
        endsAt: this.state.endsAt + extra * 1000,
        remainingSeconds: this.state.remainingSeconds + extra,
        totalSeconds: this.state.totalSeconds + extra,
      });
      return;
    }
    this.set({
      remainingSeconds: this.state.remainingSeconds + extra,
      totalSeconds: this.state.totalSeconds + extra,
    });
  }

  reset(): void {
    this.stopTicking();
    this.set({
      status: 'idle',
      remainingSeconds: this.state.totalSeconds,
      endsAt: null,
      startedAt: null,
    });
  }

  /** Clears the "finished" state after the learner has logged the session. */
  acknowledge(): void {
    this.stopTicking();
    this.set({ status: 'idle', remainingSeconds: this.state.totalSeconds, endsAt: null, startedAt: null });
  }

  setContext(patch: { subject?: string; topic?: string }): void {
    this.set(patch);
  }

  /** Minutes actually elapsed in the current/last session, for pre-filling the log dialog. */
  elapsedMinutes(): number {
    if (this.state.status === 'finished') return Math.max(1, Math.round(this.state.totalSeconds / 60));
    const remaining = this.state.remainingSeconds;
    return Math.max(1, Math.round((this.state.totalSeconds - remaining) / 60));
  }
}

export const timerStore = new TimerStore();

export function useTimer(): TimerState {
  return useSyncExternalStore(timerStore.subscribe, timerStore.getState, timerStore.getState);
}
