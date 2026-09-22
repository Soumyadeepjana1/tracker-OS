import { Link } from 'react-router-dom';
import { ALL_NAV_ITEMS } from '@/components/layout/nav';
import { Button, Card } from '@/components/ui/primitives';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { IconAlert, IconSearch } from '@/components/icons';

export function NotFoundPage() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="404"
        title="That page does not exist"
        description="The link may be outdated, or the route was mistyped. Everything else is still here."
        actions={
          <>
            <Link to="/">
              <Button variant="primary">Back to dashboard</Button>
            </Link>
            <Link to="/search">
              <Button variant="secondary" icon={<IconSearch size={15} />}>
                Search everything
              </Button>
            </Link>
          </>
        }
      />

      <Card className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
          <IconAlert size={20} />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-fg">Nothing was lost</p>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Your data lives in IndexedDB in this browser, not in the URL. Pick a destination below and carry on.
          </p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ALL_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card-base flex items-center gap-3 p-4 transition-colors hover:border-line-strong"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <item.icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-fg">{item.label}</span>
              <span className="block truncate font-mono text-[10.5px] text-fg-subtle">{item.to}</span>
            </span>
          </Link>
        ))}
      </div>
    </PageBody>
  );
}
