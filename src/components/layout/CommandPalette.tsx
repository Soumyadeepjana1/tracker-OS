import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp, type AppState } from '@/store/store';
import { groupResults, highlightSegments, searchAll, type SearchResult } from '@/lib/search';
import { ALL_NAV_ITEMS } from './nav';
import { cn, downloadFile } from '@/lib/utils';
import { Badge, Kbd, TONE_CLASSES, type Tone } from '@/components/ui/primitives';
import {
  IconBook,
  IconBulb,
  IconCalendar,
  IconChart,
  IconDashboard,
  IconDownload,
  IconFolder,
  IconGithub,
  IconLayers,
  IconNote,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTimer,
  IconUpload,
} from '@/components/icons';
import type { IconProps } from '@/components/icons';
import type { ComponentType } from 'react';

interface Command {
  id: string;
  label: string;
  hint: string;
  group: 'Navigate' | 'Create' | 'Actions';
  icon: ComponentType<IconProps>;
  run: () => void;
  keywords?: string;
}

type PaletteItem =
  | { kind: 'command'; id: string; command: Command }
  | { kind: 'result'; id: string; result: SearchResult };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => buildCommands(state, navigate, onClose), [state, navigate, onClose]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const needle = query.trim().toLowerCase();
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.keywords ?? ''}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  const results = useMemo(() => searchAll(query, state, 24), [query, state]);

  const items = useMemo<PaletteItem[]>(() => {
    if (!query.trim()) {
      return filteredCommands.slice(0, 12).map((command) => ({ kind: 'command' as const, id: command.id, command }));
    }
    return [
      ...filteredCommands.slice(0, 5).map((command) => ({ kind: 'command' as const, id: command.id, command })),
      ...results.map((result) => ({ kind: 'result' as const, id: result.id, result })),
    ];
  }, [filteredCommands, query, results]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const runItem = (item: PaletteItem) => {
    if (item.kind === 'command') {
      item.command.run();
    } else {
      navigate(item.result.route);
    }
    onClose();
  };

  const groupedResults = groupResults(results);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[8vh]" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 flex max-h-[70dvh] w-full max-w-2xl animate-rise flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <IconSearch size={17} className="shrink-0 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % Math.max(1, items.length));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + Math.max(1, items.length)) % Math.max(1, items.length));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const item = items[activeIndex];
                if (item) runItem(item);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Search courses, topics, tasks, projects, notes — or type a command…"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {!items.length ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-fg">No matches for “{query}”</p>
              <p className="mt-1 text-xs text-fg-muted">Try a topic name like “Kubernetes”, or a command like “export”.</p>
            </div>
          ) : null}

          {!query.trim() ? (
            <PaletteGroup label="Commands">
              {(items as Extract<PaletteItem, { kind: 'command' }>[]).map((item, index) => (
                <CommandRow
                  key={item.id}
                  command={item.command}
                  active={index === activeIndex}
                  index={index}
                  onSelect={() => runItem(item)}
                  onHover={() => setActiveIndex(index)}
                />
              ))}
            </PaletteGroup>
          ) : (
            <>
              {filteredCommands.length ? (
                <PaletteGroup label="Commands">
                  {(items as PaletteItem[])
                    .filter((item): item is Extract<PaletteItem, { kind: 'command' }> => item.kind === 'command')
                    .map((item, index) => (
                      <CommandRow
                        key={item.id}
                        command={item.command}
                        active={index === activeIndex}
                        index={index}
                        onSelect={() => runItem(item)}
                        onHover={() => setActiveIndex(index)}
                      />
                    ))}
                </PaletteGroup>
              ) : null}
              {groupedResults.map((group, groupIndex) => (
                <PaletteGroup key={group.type} label={group.label}>
                  {group.items.map((result, resultIndex) => {
                    const index =
                      filteredCommands.slice(0, 5).length +
                      groupedResults
                        .slice(0, groupIndex)
                        .reduce((total, entry) => total + entry.items.length, 0) +
                      resultIndex;
                    return (
                      <ResultRow
                        key={`${group.type}-${result.id}`}
                        result={result}
                        query={query}
                        active={index === activeIndex}
                        index={index}
                        onSelect={() => runItem({ kind: 'result', id: result.id, result })}
                        onHover={() => setActiveIndex(index)}
                      />
                    );
                  })}
                </PaletteGroup>
              ))}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-2.5 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-2">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to navigate
            <Kbd>↵</Kbd> to run
          </span>
          <span className="flex items-center gap-2">
            <Kbd>ctrl</Kbd>+<Kbd>k</Kbd> anytime
          </span>
        </footer>
      </div>
    </div>
  );
}

function PaletteGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">{label}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({
  active,
  index,
  onSelect,
  onHover,
  children,
}: {
  active: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-brand-soft' : 'hover:bg-surface-3',
      )}
    >
      {children}
    </button>
  );
}

function CommandRow({
  command,
  active,
  index,
  onSelect,
  onHover,
}: {
  command: Command;
  active: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <Row active={active} index={index} onSelect={onSelect} onHover={onHover}>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-brand text-brand-fg' : 'bg-surface-3 text-fg-muted')}>
        <command.icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-fg">{command.label}</span>
        <span className="block truncate text-[11.5px] text-fg-subtle">{command.hint}</span>
      </span>
      <Badge tone={active ? 'brand' : 'neutral'}>{command.group}</Badge>
    </Row>
  );
}

function ResultRow({
  result,
  query,
  active,
  index,
  onSelect,
  onHover,
}: {
  result: SearchResult;
  query: string;
  active: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  const tone: Tone = result.tone;
  return (
    <Row active={active} index={index} onSelect={onSelect} onHover={onHover}>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[tone].soft)}>
        <ResultIcon type={result.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-fg">
          {highlightSegments(result.title, query).map((segment, segmentIndex) =>
            segment.match ? (
              <mark key={segmentIndex} className="rounded bg-brand/25 px-0.5 text-fg">
                {segment.text}
              </mark>
            ) : (
              <span key={segmentIndex}>{segment.text}</span>
            ),
          )}
        </span>
        <span className="block truncate text-[11.5px] text-fg-subtle">{result.subtitle}</span>
      </span>
      <IconChevronSmall />
    </Row>
  );
}

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  const map: Record<SearchResult['type'], ComponentType<IconProps>> = {
    task: IconCalendar,
    course: IconBook,
    topic: IconLayers,
    project: IconFolder,
    note: IconNote,
    session: IconTimer,
  };
  const Component = map[type];
  return <Component size={15} />;
}

function IconChevronSmall() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-fg-subtle" aria-hidden="true">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildCommands(state: AppState, navigate: (route: string) => void, onClose: () => void): Command[] {
  const exportData = () => {
    downloadFile('devops-learning-os-backup.json', store.exportBackup());
    store.toast({ title: 'Backup exported', message: 'devops-learning-os-backup.json saved.', tone: 'ok' });
  };

  return [
    ...ALL_NAV_ITEMS.map<Command>((item) => ({
      id: `nav-${item.to}`,
      label: `Open ${item.label}`,
      hint: item.hint ?? `Go to ${item.label.toLowerCase()}`,
      group: 'Navigate',
      icon: item.icon,
      keywords: item.to,
      run: () => navigate(item.to),
    })),
    {
      id: 'create-task',
      label: 'Add task',
      hint: 'Plan a study task for any day',
      group: 'Create',
      icon: IconPlus,
      keywords: 'new task planner study',
      run: () => navigate('/planner?new=task'),
    },
    {
      id: 'create-note',
      label: 'Add note',
      hint: 'Write a markdown note',
      group: 'Create',
      icon: IconNote,
      keywords: 'new note markdown',
      run: () => navigate('/notes?new=note'),
    },
    {
      id: 'create-course',
      label: 'Add course',
      hint: 'Track a new course',
      group: 'Create',
      icon: IconBook,
      keywords: 'new course udemy youtube',
      run: () => navigate('/courses?new=course'),
    },
    {
      id: 'create-topic',
      label: 'Add topic',
      hint: 'Track a new topic',
      group: 'Create',
      icon: IconLayers,
      keywords: 'new topic kubernetes docker',
      run: () => navigate('/topics?new=topic'),
    },
    {
      id: 'create-project',
      label: 'Add project',
      hint: 'Start a new portfolio project',
      group: 'Create',
      icon: IconFolder,
      keywords: 'new project build',
      run: () => navigate('/projects?new=project'),
    },
    {
      id: 'start-timer',
      label: 'Start timer',
      hint: 'Open the Pomodoro timer',
      group: 'Actions',
      icon: IconTimer,
      keywords: 'pomodoro focus',
      run: () => navigate('/timer'),
    },
    {
      id: 'search',
      label: 'Search everything',
      hint: 'Kubernetes, Terraform, notes…',
      group: 'Actions',
      icon: IconSearch,
      keywords: 'find query',
      run: () => navigate('/search'),
    },
    {
      id: 'export',
      label: 'Export backup',
      hint: 'Download devops-learning-os-backup.json',
      group: 'Actions',
      icon: IconDownload,
      keywords: 'download save json',
      run: exportData,
    },
    {
      id: 'import',
      label: 'Import backup',
      hint: 'Restore from a JSON backup file',
      group: 'Actions',
      icon: IconUpload,
      keywords: 'restore upload json',
      run: () => navigate('/settings?tab=data'),
    },
    {
      id: 'github',
      label: 'Open GitHub activity',
      hint: 'Public repositories and events',
      group: 'Actions',
      icon: IconGithub,
      keywords: 'repos repositories',
      run: () => navigate('/github'),
    },
    {
      id: 'assistant',
      label: 'Open AI Assistant',
      hint: 'Ask for a study plan or analysis',
      group: 'Actions',
      icon: IconSparkles,
      keywords: 'ai chat plan',
      run: () => navigate('/assistant'),
    },
    {
      id: 'revision',
      label: 'Show revision queue',
      hint: `${state.topics.length} topics tracked`,
      group: 'Actions',
      icon: IconBulb,
      keywords: 'spaced repetition',
      run: () => navigate('/revision'),
    },
    {
      id: 'analytics',
      label: 'Open analytics',
      hint: 'Charts, trends and consistency',
      group: 'Actions',
      icon: IconChart,
      keywords: 'charts statistics',
      run: () => navigate('/analytics'),
    },
    {
      id: 'settings',
      label: 'Open settings',
      hint: 'Profile, targets, AI provider, data',
      group: 'Actions',
      icon: IconSettings,
      keywords: 'preferences config theme',
      run: () => {
        navigate('/settings');
        onClose();
      },
    },
    {
      id: 'dashboard',
      label: 'Go to dashboard',
      hint: 'Everything at a glance',
      group: 'Navigate',
      icon: IconDashboard,
      keywords: 'home overview',
      run: () => navigate('/'),
    },
  ];
}
