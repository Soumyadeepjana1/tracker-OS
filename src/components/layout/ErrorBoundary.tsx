import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card } from '@/components/ui/primitives';
import { IconAlert } from '@/components/icons';

interface Props {
  children: ReactNode;
  /** Rendered instead of the default panel when provided. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a single broken view from taking down the whole dashboard. Data lives
 * in IndexedDB, so reloading never costs the user their progress.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[devops-os] view crashed', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <Card className="mx-auto my-10 max-w-2xl">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <IconAlert size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-fg">This view hit an error</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Nothing was lost — your data lives in your browser’s IndexedDB. Try reloading the view, or open a
              different page from the sidebar.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11.5px] text-danger">
              {error.message}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={this.reset}>
                Try again
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }
}
