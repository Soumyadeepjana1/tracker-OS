import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconClose, IconPlus } from '@/components/icons';

const CONTROL_BASE =
  'w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle ' +
  'transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg-muted">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-[11.5px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, 'h-10 placeholder:font-normal', invalid && 'border-danger focus:border-danger', className)}
    />
  );
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, 'min-h-24 resize-y py-2.5 leading-relaxed', invalid && 'border-danger', className)}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={cn(CONTROL_BASE, 'h-10 cursor-pointer appearance-none pr-9', className)}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="m6 9.5 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer select-none items-start gap-2.5 text-sm text-fg', className)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--brand)]"
      />
      <span className="flex flex-col">
        <span className="leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 text-[11.5px] text-fg-subtle">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Comma/enter separated tag editor used by notes and projects. */
export function TagInput({
  value,
  onChange,
  placeholder = 'Add a tag and press Enter',
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const additions = raw
      .split(',')
      .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean);
    if (!additions.length) return;
    onChange(Array.from(new Set([...value, ...additions])));
    setDraft('');
  };

  const remainingSuggestions = suggestions.filter((tag) => !value.includes(tag)).slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className={cn(CONTROL_BASE, 'flex min-h-10 flex-wrap items-center gap-1.5 py-1.5')}>
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-fg"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((entry) => entry !== tag))}
              className="text-fg-subtle transition-colors hover:text-danger"
            >
              <IconClose size={11} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit(draft);
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
        />
      </div>
      {remainingSuggestions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {remainingSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => commit(tag)}
              className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-fg-subtle transition-colors hover:border-brand hover:text-brand"
            >
              <IconPlus size={10} strokeWidth={2.6} />
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20.5 20.5-4-4" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(CONTROL_BASE, 'h-10 pl-9 pr-9')}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle transition-colors hover:text-fg"
        >
          <IconClose size={14} strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}

/** Compact on/off switch used by list filters. */
export function FilterToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors',
        checked ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line text-fg-muted hover:text-fg',
      )}
    >
      <span
        className={cn(
          'relative h-3.5 w-6 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all',
            checked ? 'left-3' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function FormGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">{children}</div>;
}
