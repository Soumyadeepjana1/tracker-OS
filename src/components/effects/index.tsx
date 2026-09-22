import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import { cn, clamp } from '@/lib/utils';

/**
 * Presentation-only "HUD" effects.
 *
 * Everything here is dependency-free, GPU-cheap and degrades to a static
 * rendering when the user prefers reduced motion — the app never depends on an
 * animation to convey information.
 */

/* ---------------------------- ambient background -------------------------- */

/**
 * Slow moving light sources behind the shell.
 *
 * Positions are fixed (not random) so the background never jumps between
 * renders, and `pointer-events-none` keeps it out of the way of the UI.
 */
export function AuroraBackground({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)} aria-hidden="true">
      <div
        className={cn('aurora-blob h-[38rem] w-[38rem] opacity-[0.22]', !reduced && 'animate-aurora')}
        style={{ top: '-14rem', left: '-10rem', background: 'radial-gradient(circle at 30% 30%, var(--brand), transparent 68%)' }}
      />
      <div
        className={cn('aurora-blob h-[34rem] w-[34rem] opacity-[0.18]', !reduced && 'animate-aurora')}
        style={{
          top: '18%',
          right: '-12rem',
          animationDelay: '-8s',
          background: 'radial-gradient(circle at 60% 40%, var(--accent), transparent 68%)',
        }}
      />
      <div
        className={cn('aurora-blob h-[30rem] w-[30rem] opacity-[0.14]', !reduced && 'animate-aurora')}
        style={{
          bottom: '-12rem',
          left: '22%',
          animationDelay: '-16s',
          background: 'radial-gradient(circle at 50% 50%, var(--ok), transparent 70%)',
        }}
      />
      <div className="hud-grid absolute inset-0 opacity-[0.35]" />
    </div>
  );
}

/* -------------------------------- counters -------------------------------- */

/**
 * Animated number.
 *
 * Re-renders only the text node, and jumps straight to the value when reduced
 * motion is requested.
 */
export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduced ? value : 0));
  const fromRef = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) {
      setDisplay(value);
      return;
    }

    let frame = requestAnimationFrame(function step(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + delta * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    });

    const start = performance.now();
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return (
    <span className={className}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------ spotlight card ----------------------------- */

/**
 * Card with a pointer-following highlight — the modern “product site” feel.
 * Pure CSS gradient, so there is no per-frame React work beyond one state write
 * while the pointer moves.
 */
export function SpotlightCard({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const reduced = useReducedMotion();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className={cn('group relative overflow-hidden', className)}
      onPointerMove={
        reduced
          ? undefined
          : (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
            }
      }
      onPointerLeave={() => setPoint(null)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={
          point
            ? {
                background: `radial-gradient(420px circle at ${point.x}px ${point.y}px, color-mix(in oklab, var(--brand) 20%, transparent), transparent 62%)`,
              }
            : undefined
        }
        aria-hidden="true"
      />
      <div className={cn('relative', contentClassName)}>{children}</div>
    </div>
  );
}

/* ------------------------------- progress ring ----------------------------- */

/**
 * Single-value progress ring with a gradient stroke and animated sweep.
 * Used by the mission-control HUD and focus mode.
 */
export function HudRing({
  value,
  size = 180,
  thickness = 13,
  trackColor = 'var(--surface-3)',
  className,
  children,
  glow = true,
}: {
  value: number;
  size?: number;
  thickness?: number;
  trackColor?: string;
  className?: string;
  children?: ReactNode;
  glow?: boolean;
}) {
  const gradientId = useId();
  const reduced = useReducedMotion();
  const clamped = clamp(value, 0, 100);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="55%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--ok)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduced ? undefined : 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)',
            filter: glow ? 'drop-shadow(0 0 10px color-mix(in oklab, var(--brand) 45%, transparent))' : undefined,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/* --------------------------------- confetti -------------------------------- */

const CONFETTI_COLORS = ['#6d5efc', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'];

/**
 * One-shot celebration burst.
 *
 * Re-fires whenever `fireKey` changes; render nothing (key `0`) to stay idle.
 * Purely decorative, so it is skipped entirely for reduced-motion users.
 */
export function ConfettiBurst({ fireKey, className }: { fireKey: number; className?: string }) {
  const reduced = useReducedMotion();
  if (!fireKey || reduced) return null;

  return (
    <div
      key={fireKey}
      className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 h-0', className)}
      aria-hidden="true"
    >
      {Array.from({ length: 28 }).map((_, index) => {
        const angle = (index / 28) * Math.PI * 2;
        const spread = 52 + (index % 6) * 30;
        const style = {
          left: '50%',
          top: 0,
          backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          animationDelay: `${(index % 7) * 40}ms`,
          '--confetti-x': `${Math.round(Math.cos(angle) * spread)}px`,
          '--confetti-rot': `${(index % 2 ? 1 : -1) * (200 + index * 14)}deg`,
        } as CSSProperties;

        return <span key={index} className="absolute h-2 w-2 animate-confetti rounded-[3px]" style={style} />;
      })}
    </div>
  );
}

/* ---------------------------------- clock --------------------------------- */

/**
 * Live clock for the HUD. Rendered client-side only, and the parent decides
 * whether it is worth showing on small screens.
 */
export function LiveClock({ className, showDate = false }: { className?: string; showDate?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      {showDate ? ` · ${now.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}` : ''}
    </span>
  );
}

/** Thin animated energy bar used as a section divider in the HUD. */
export function EnergyBar({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div className={cn('relative h-px w-full overflow-hidden bg-line', className)} aria-hidden="true">
      {reduced ? null : (
        <span className="animate-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-brand to-transparent" />
      )}
    </div>
  );
}
