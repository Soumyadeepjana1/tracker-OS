import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconChart } from '@/components/icons';

export type Tone = 'neutral' | 'info' | 'brand' | 'ok' | 'warn' | 'danger' | 'accent';

/** Central tone table so badges, bars and cards stay visually consistent. */
export const TONE_CLASSES: Record<Tone, { text: string; soft: string; bar: string; border: string; ring: string }> = {
  neutral: {
    text: 'text-fg-muted',
    soft: 'bg-surface-3 text-fg-muted',
    bar: 'bg-fg-subtle',
    border: 'border-line',
    ring: 'stroke-fg-subtle',
  },
  info: {
    text: 'text-info',
    soft: 'bg-info-soft text-info',
    bar: 'bg-info',
    border: 'border-info/40',
    ring: 'stroke-info',
  },
  brand: {
    text: 'text-brand',
    soft: 'bg-brand-soft text-brand',
    bar: 'bg-brand',
    border: 'border-brand/40',
    ring: 'stroke-brand',
  },
  ok: {
    text: 'text-ok',
    soft: 'bg-ok-soft text-ok',
    bar: 'bg-ok',
    border: 'border-ok/40',
    ring: 'stroke-ok',
  },
  warn: {
    text: 'text-warn',
    soft: 'bg-warn-soft text-warn',
    bar: 'bg-warn',
    border: 'border-warn/40',
    ring: 'stroke-warn',
  },
  danger: {
    text: 'text-danger',
    soft: 'bg-danger-soft text-danger',
    bar: 'bg-danger',
    border: 'border-danger/40',
    ring: 'stroke-danger',
  },
  accent: {
    text: 'text-accent',
    soft: 'bg-accent-soft text-accent',
    bar: 'bg-accent',
    border: 'border-accent/40',
    ring: 'stroke-accent',
  },
};

export function progressTone(value: number): Tone {
  if (value >= 80) return 'ok';
  if (value >= 50) return 'brand';
  if (value >= 25) return 'warn';
  return 'danger';
}

/* -------------------------------- button -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-fg hover:brightness-110 active:brightness-95 shadow-[0_10px_30px_-12px_var(--brand)] border border-transparent',
  secondary: 'bg-surface-3 text-fg hover:bg-surface-hover border border-line',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-3 hover:text-fg border border-transparent',
  danger: 'bg-danger text-white hover:brightness-110 border border-transparent',
  outline: 'bg-transparent text-fg border border-line-strong hover:bg-surface-3',
  subtle: 'bg-brand-soft text-brand hover:brightness-105 border border-transparent',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-[0.5px]',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner size={size === 'sm' ? 13 : 15} /> : icon}
      {children ? <span className="truncate">{children}</span> : null}
      {trailingIcon}
    </button>
  );
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  icon,
  ...rest
}: ButtonProps & { label: string }) {
  const dimension = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-9 w-9 rounded-xl';
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-all duration-150 disabled:opacity-50',
        dimension,
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {icon}
    </button>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* --------------------------------- badge -------------------------------- */

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const toneClass = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        toneClass.soft,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', toneClass.bar)} /> : null}
      {children}
    </span>
  );
}

/* ---------------------------------- card -------------------------------- */

export function Card({
  children,
  className,
  padded = true,
  interactive = false,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  const Component = as;
  return (
    <Component
      className={cn(
        'card-base',
        padded && 'p-5',
        interactive && 'transition-all duration-200 hover:border-line-strong hover:shadow-pop',
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className={cn('flex flex-col', className)} padded={false}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-fg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={cn('flex-1 px-5 py-4', bodyClassName)}>{children}</div>
    </Card>
  );
}

/* ------------------------------- progress ------------------------------- */

export function ProgressBar({
  value,
  tone,
  className,
  showValue = false,
  height = 8,
  label,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  showValue?: boolean;
  height?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const resolvedTone = tone ?? progressTone(clamped);
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className="relative flex-1 overflow-hidden rounded-full bg-surface-3"
        style={{ height }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', TONE_CLASSES[resolvedTone].bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue ? (
        <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-fg-muted">{clamped}%</span>
      ) : null}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 7,
  tone,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const resolvedTone = tone ?? progressTone(clamped);
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', TONE_CLASSES[resolvedTone].ring)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* -------------------------------- stat card ----------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)} interactive>
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.14] blur-2xl',
          TONE_CLASSES[tone].bar,
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
          <p className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight text-fg">{value}</p>
          {hint ? <p className="mt-2 text-xs text-fg-muted">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE_CLASSES[tone].soft)}>
            {icon}
          </span>
        ) : null}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Card>
  );
}

/* ------------------------------ empty state ----------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg-subtle">
        {icon ?? <IconChart size={22} />}
      </span>
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/* -------------------------------- skeleton ------------------------------ */

export function Skeleton({ className, height }: { className?: string; height?: number }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-lg bg-gradient-to-r from-surface-3 via-surface-hover to-surface-3 bg-[length:200%_100%]',
        className,
      )}
      style={height ? { height } : undefined}
    />
  );
}

/* ------------------------------- segmented ------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1',
        size === 'sm' ? 'text-[12px]' : 'text-[13px]',
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
              size === 'sm' ? 'px-2.5' : 'px-3',
              active ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                  active ? 'bg-surface-3 text-fg-muted' : 'bg-surface-3 text-fg-subtle',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1.5 font-mono text-[10px] font-medium text-fg-subtle">
      {children}
    </kbd>
  );
}

export function Tag({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors',
        active
          ? 'bg-brand text-brand-fg'
          : 'border border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
      )}
    >
      #{children}
    </Component>
  );
}
