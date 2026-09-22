import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { ConfirmDialog, Toaster } from '@/components/ui/overlay';
import { Button, Card, Skeleton } from '@/components/ui/primitives';
import { IconAlert, IconClose, IconDatabase } from '@/components/icons';
import { useApp } from '@/store/store';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const state = useApp();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Global Ctrl/Cmd+K shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (state.status === 'loading') {
    return <BootScreen />;
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Card className="max-w-lg">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <IconAlert size={20} />
            </span>
            <div>
              <h1 className="text-base font-semibold text-fg">Local storage could not be opened</h1>
              <p className="mt-1 text-sm text-fg-muted">
                {state.error ?? 'Unknown error'}. Your data may be intact — try reloading, or use a different browser
                profile.
              </p>
              <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar />
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 h-full w-72 animate-rise shadow-pop">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute -right-11 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted"
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />

        {state.persistenceWarning ? (
          <div className="flex items-start gap-2.5 border-b border-warn/30 bg-warn-soft px-4 py-2.5 text-[12.5px] text-warn sm:px-6">
            <IconAlert size={15} className="mt-0.5 shrink-0" />
            <p>
              <strong className="font-semibold">Storage warning.</strong> {state.persistenceWarning}
            </p>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-3 pb-16 pt-5 sm:px-5 lg:px-7">
          <div key={location.pathname} className="mx-auto w-full max-w-[1500px] animate-fade-in">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[11px] text-fg-subtle sm:px-6">
          <span className="flex items-center gap-2">
            <IconDatabase size={12} />
            {state.lastSavedAt
              ? `All changes saved locally · ${new Date(state.lastSavedAt).toLocaleTimeString()}`
              : 'All data lives in your browser — no server, no account.'}
          </span>
          <span>DevOps Learning OS · client-side only</span>
        </footer>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ConfirmDialog />
      <Toaster />
    </div>
  );
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col gap-6 p-6 lg:flex-row">
      <div className={cn('hidden w-72 shrink-0 flex-col gap-3 lg:flex')}>
        <Skeleton className="h-9 w-40" />
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2 w-full" />
            </Card>
          ))}
        </div>
        <Card className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    </div>
  );
}
