import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { store, useApp } from '@/store/store';
import { Button, IconButton, TONE_CLASSES } from './primitives';
import { IconAlert, IconCheckCircle, IconClose, IconClock } from '@/components/icons';

/* --------------------------------- modal -------------------------------- */

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-pop',
          'animate-rise rounded-t-2xl sm:rounded-2xl',
          MODAL_SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-fg">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
          </div>
          <IconButton label="Close" icon={<IconClose size={16} />} onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------- confirm dialog ---------------------------- */

/** Renders whatever `store.requestConfirmation()` queued. */
export function ConfirmDialog() {
  const confirm = useApp().confirm;
  if (!confirm) return null;

  const tone = confirm.tone ?? 'brand';

  return (
    <Modal
      open
      size="sm"
      title={confirm.title}
      onClose={() => store.cancelConfirmation()}
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" onClick={() => store.cancelConfirmation()}>
            {confirm.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => void store.resolveConfirmation()}
          >
            {confirm.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'danger' ? TONE_CLASSES.danger.soft : TONE_CLASSES.brand.soft,
          )}
        >
          <IconAlert size={18} />
        </span>
        <div className="min-w-0 text-sm text-fg-muted">
          <p className="whitespace-pre-line">{confirm.message}</p>
          {confirm.detail ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11.5px] text-fg-muted">
              {confirm.detail}
            </pre>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- toast -------------------------------- */

const TOAST_ICONS = {
  info: <IconClock size={16} />,
  ok: <IconCheckCircle size={16} />,
  warn: <IconAlert size={16} />,
  danger: <IconAlert size={16} />,
} as const;

export function Toaster() {
  const toasts = useApp().toasts;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex animate-rise items-start gap-3 rounded-xl border border-line bg-surface/95 p-3.5 shadow-pop backdrop-blur"
        >
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              TONE_CLASSES[toast.tone].soft,
            )}
          >
            {TOAST_ICONS[toast.tone]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-fg">{toast.title}</p>
            {toast.message ? <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{toast.message}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => store.dismissToast(toast.id)}
            className="text-fg-subtle transition-colors hover:text-fg"
          >
            <IconClose size={14} strokeWidth={2.2} />
          </button>
        </div>
      ))}
    </div>
  );
}
