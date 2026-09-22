import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from './nav';
import { cn, formatMinutes } from '@/lib/utils';
import { computeAnalytics } from '@/lib/analytics';
import { store, useApp } from '@/store/store';
import { Badge, ProgressBar } from '@/components/ui/primitives';
import { IconFlame, IconTerminal } from '@/components/icons';
import { useMemo } from 'react';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const state = useApp();
  const analytics = useMemo(() => computeAnalytics(state), [state]);

  const todayPercent = analytics.todayProgress;
  const studyMinutes = formatMinutes(analytics.minutesToday);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-white shadow-[0_10px_24px_-12px_var(--brand)]">
          <IconTerminal size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-tight text-fg">DevOps Learning OS</p>
          <p className="truncate text-[11px] text-fg-subtle">local-first · v1.0</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const count = item.badge?.(state);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      title={item.hint}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150',
                          isActive
                            ? 'bg-brand-soft text-brand shadow-[inset_0_0_0_1px_var(--line)]'
                            : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={17} strokeWidth={isActive ? 2.1 : 1.8} />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {count ? (
                            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fg-muted">
                              {count}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-xl border border-line bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <IconFlame size={13} className="text-warn" />
              Streak
            </span>
            <Badge tone={analytics.streak.current > 0 ? 'warn' : 'neutral'}>
              🔥 {analytics.streak.current}d
            </Badge>
          </div>
          <p className="mt-2 text-[11.5px] text-fg-muted">
            {studyMinutes} today · longest {analytics.streak.longest} days
          </p>
          <ProgressBar value={todayPercent} className="mt-2.5" height={6} />
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              store.toast({
                title: analytics.overall + '% overall progress',
                message: `${analytics.topicStats.completed} of ${analytics.topicStats.total} topics completed.`,
                tone: 'info',
              });
            }}
            className="mt-3 w-full rounded-lg bg-surface-3 px-2.5 py-1.5 text-[11.5px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Overall {analytics.overall}% complete
          </button>
        </div>
      </div>
    </aside>
  );
}
