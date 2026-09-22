import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { ALL_NAV_ITEMS } from './nav';
import { cn, formatMinutes } from '@/lib/utils';
import { IconButton, Kbd, ProgressBar } from '@/components/ui/primitives';
import {
  IconAlert,
  IconBell,
  IconBook,
  IconCalendar,
  IconFolder,
  IconLayers,
  IconMenu,
  IconMoon,
  IconNote,
  IconPlus,
  IconSearch,
  IconSun,
  IconTimer,
} from '@/components/icons';
import { formatClock } from '@/lib/date';
import { useTimer } from '@/store/timer';

export function Topbar({
  onOpenMenu,
  onOpenPalette,
}: {
  onOpenMenu: () => void;
  onOpenPalette: () => void;
}) {
  const state = useApp();
  const timer = useTimer();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const analytics = useMemo(() => computeAnalytics(state), [state]);
  const activeNav = ALL_NAV_ITEMS.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)));

  const pendingToday = analytics.today.tasks.filter((task) => task.status === 'pending' || task.status === 'in-progress');
  const revisionCount = analytics.revisionTopics.length;
  const notificationCount = pendingToday.length + (revisionCount ? 1 : 0) + (state.github.status === 'error' ? 1 : 0);

  const initials =
    (state.settings.name || 'DevOps Learner')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'DL';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-3 backdrop-blur-xl sm:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg lg:hidden"
      >
        <IconMenu size={18} />
      </button>

      <div className="hidden min-w-0 flex-col sm:flex">
        <h1 className="truncate text-[15px] font-semibold leading-tight text-fg">
          {activeNav?.label ?? 'DevOps Learning OS'}
        </h1>
        <p className="truncate text-[11.5px] text-fg-subtle">
          {formatMinutes(analytics.minutesToday)} today · 🔥 {analytics.streak.current} day streak · {analytics.overall}% overall
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-auto flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 text-left text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted sm:max-w-md"
      >
        <IconSearch size={16} />
        <span className="flex-1 truncate">Search or run a command…</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      {timer.status !== 'idle' ? (
        <button
          type="button"
          onClick={() => navigate('/timer')}
          className={cn(
            'hidden items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[12px] transition-colors sm:flex',
            timer.status === 'running'
              ? 'border-ok/40 bg-ok-soft text-ok'
              : timer.status === 'paused'
                ? 'border-warn/40 bg-warn-soft text-warn'
                : 'border-brand/40 bg-brand-soft text-brand',
          )}
          title="Open the study timer"
        >
          <IconTimer size={14} />
          {formatClock(timer.remainingSeconds)}
          <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-current" />
        </button>
      ) : null}

      <div className="relative">
        <IconButton
          label="Quick add"
          variant="secondary"
          icon={<IconPlus size={16} />}
          onClick={() => setQuickAddOpen((open) => !open)}
        />
        {quickAddOpen ? (
          <Popover onClose={() => setQuickAddOpen(false)}>
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">Create</p>
            {[
              { label: 'Study task', to: '/planner?new=task', icon: IconCalendar },
              { label: 'Note', to: '/notes?new=note', icon: IconNote },
              { label: 'Course', to: '/courses?new=course', icon: IconBook },
              { label: 'Topic', to: '/topics?new=topic', icon: IconLayers },
              { label: 'Project', to: '/projects?new=project', icon: IconFolder },
            ].map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  navigate(item.to);
                  setQuickAddOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <item.icon size={15} />
                {item.label}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              onClick={() => {
                navigate('/timer');
                setQuickAddOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <IconTimer size={15} />
              Start a focus session
            </button>
          </Popover>
        ) : null}
      </div>

      <div className="relative">
        <IconButton
          label="Notifications"
          variant="secondary"
          icon={
            <span className="relative flex">
              <IconBell size={16} />
              {notificationCount ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              ) : null}
            </span>
          }
          onClick={() => setMenuOpen((open) => !open)}
        />
        {menuOpen ? (
          <Popover onClose={() => setMenuOpen(false)} width="w-80">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              Notifications
            </p>
            {!notificationCount ? (
              <p className="px-3 pb-3 text-[12.5px] text-fg-muted">
                You are all caught up. Nothing pending and no revision due.
              </p>
            ) : null}
            {pendingToday.length ? (
              <NotificationBlock
                tone="brand"
                title={`${pendingToday.length} task(s) left today`}
                lines={pendingToday.slice(0, 3).map((task) => `${task.title} · ${formatMinutes(task.plannedMinutes)}`)}
                onOpen={() => {
                  navigate('/planner');
                  setMenuOpen(false);
                }}
              />
            ) : null}
            {revisionCount ? (
              <NotificationBlock
                tone="warn"
                title={`${revisionCount} topic(s) need revision`}
                lines={analytics.revisionTopics.slice(0, 3).map((topic) => `${topic.name} · confidence ${topic.confidence}/5`)}
                onOpen={() => {
                  navigate('/revision');
                  setMenuOpen(false);
                }}
              />
            ) : null}
            {state.github.status === 'error' ? (
              <NotificationBlock
                tone="danger"
                title="GitHub data unavailable"
                lines={[state.github.error ?? 'Unknown error']}
                onOpen={() => {
                  navigate('/github');
                  setMenuOpen(false);
                }}
              />
            ) : null}
            <div className="border-t border-line px-3 py-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
                Today’s target
              </p>
              <ProgressBar value={analytics.todayProgress} showValue />
            </div>
          </Popover>
        ) : null}
      </div>

      <IconButton
        label="Toggle theme"
        variant="secondary"
        icon={state.settings.theme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
        onClick={() => {
          const next = state.settings.theme === 'light' ? 'dark' : 'light';
          void store.updateSettings({ theme: next });
        }}
      />

      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 py-1.5 pl-1.5 pr-3 transition-colors hover:border-line-strong"
        title="Profile and settings"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-accent font-mono text-[11px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate text-[12.5px] font-medium text-fg sm:block">
          {state.settings.name || 'Set your name'}
        </span>
      </button>
    </header>
  );
}

function NotificationBlock({
  tone,
  title,
  lines,
  onOpen,
}: {
  tone: 'brand' | 'warn' | 'danger';
  title: string;
  lines: string[];
  onOpen: () => void;
}) {
  const toneStyles = {
    brand: 'border-brand/30 bg-brand-soft',
    warn: 'border-warn/30 bg-warn-soft',
    danger: 'border-danger/30 bg-danger-soft',
  } as const;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('mx-2 mb-2 flex w-[calc(100%-1rem)] flex-col gap-1 rounded-xl border p-3 text-left', toneStyles[tone])}
    >
      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-fg">
        <IconAlert size={13} />
        {title}
      </span>
      {lines.map((line, index) => (
        <span key={index} className="truncate text-[11.5px] text-fg-muted">
          {line}
        </span>
      ))}
    </button>
  );
}

function Popover({
  children,
  onClose,
  width = 'w-60',
}: {
  children: React.ReactNode;
  onClose: () => void;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute right-0 top-12 z-40 animate-pop overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
        width,
      )}
    >
      {children}
    </div>
  );
}
