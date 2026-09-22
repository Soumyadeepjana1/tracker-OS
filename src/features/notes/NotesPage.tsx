import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { renderMarkdown, stripMarkdown } from '@/lib/markdown';
import type { Note } from '@/types';
import { formatTimestamp, relativeTime } from '@/lib/date';
import { cn, downloadFile, truncate } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  SectionCard,
  Segmented,
  StatCard,
  Tag,
} from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/form';
import { NoteDialog } from '@/features/shared/NoteDialog';
import { notesToMarkdown } from '@/lib/backup';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconArchive,
  IconCopy,
  IconDownload,
  IconNote,
  IconPencil,
  IconPin,
  IconPlus,
  IconSparkles,
  IconTrash,
} from '@/components/icons';

type Filter = 'all' | 'pinned' | 'archived';

export function NotesPage() {
  const state = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const [newParam, setNewParam] = useQueryFlag('new');
  const [focusParam, setFocusParam] = useQueryFlag('focus');

  useEffect(() => {
    if (newParam === 'note') {
      setEditing(null);
      setDialogOpen(true);
      setNewParam(undefined);
    }
  }, [newParam, setNewParam]);

  useEffect(() => {
    if (!focusParam) return;
    setSelectedId(focusParam);
    setFocusParam(undefined);
  }, [focusParam, setFocusParam]);

  const allTags = useMemo(
    () => Array.from(new Set(state.notes.flatMap((note) => note.tags))).sort(),
    [state.notes],
  );

  const notes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return state.notes
      .filter((note) => {
        if (filter === 'pinned') return note.pinned && !note.archived;
        if (filter === 'archived') return note.archived;
        return !note.archived;
      })
      .filter((note) => (tag ? note.tags.includes(tag) : true))
      .filter((note) =>
        needle
          ? [note.title, note.topic, note.content, note.tags.join(' ')].join(' ').toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [state.notes, search, filter, tag]);

  const selected = useMemo(() => {
    const found = notes.find((note) => note.id === selectedId);
    if (found) return found;
    // Keep something useful on screen when the selection is filtered out.
    return notes[0] ?? null;
  }, [notes, selectedId]);

  const html = useMemo(() => (selected ? renderMarkdown(selected.content) : ''), [selected]);

  const stats = useMemo(
    () => ({
      total: state.notes.length,
      pinned: state.notes.filter((note) => note.pinned).length,
      archived: state.notes.filter((note) => note.archived).length,
      tags: allTags.length,
      characters: state.notes.reduce((total, note) => total + note.content.length, 0),
    }),
    [state.notes, allTags.length],
  );

  const deleteNote = (note: Note) => {
    store.requestConfirmation({
      title: 'Delete note?',
      message: `“${note.title}” will be permanently deleted. Pinned notes are deleted too — this cannot be undone.`,
      confirmLabel: 'Delete note',
      tone: 'danger',
      onConfirm: async () => {
        await store.deleteNote(note.id);
        store.toast({ title: 'Note deleted', message: note.title, tone: 'info' });
      },
    });
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Knowledge base"
        title="Notes"
        description="Interview-ready notes in markdown: definitions, commands, examples, common mistakes and your own mental models."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<IconDownload size={15} />}
              onClick={() => {
                if (!state.notes.length) {
                  store.toast({ title: 'No notes to export', tone: 'warn' });
                  return;
                }
                downloadFile('devops-notes.md', notesToMarkdown(state.notes), 'text/markdown');
                store.toast({ title: 'Notes exported', message: 'devops-notes.md saved.', tone: 'ok' });
              }}
            >
              Export markdown
            </Button>
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              New note
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Notes" value={stats.total} hint={`${stats.pinned} pinned · ${stats.archived} archived`} icon={<IconNote size={16} />} tone="brand" />
        <StatCard label="Tags" value={stats.tags} hint="Reused across your notes" icon={<IconSparkles size={16} />} tone="accent" />
        <StatCard
          label="Written"
          value={`${Math.round(stats.characters / 1000)}k`}
          hint="Characters of notes — your own reference book"
          icon={<IconNote size={16} />}
          tone="ok"
        />
        <StatCard
          label="Last updated"
          value={state.notes.length ? relativeTime(state.notes[0].updatedAt).replace(' ago', '') : '—'}
          hint={state.notes.length ? state.notes[0].title : 'No notes yet'}
          icon={<IconPencil size={16} />}
          tone="info"
        />
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search titles, topics, tags and content…"
          className="min-w-56 flex-1"
        />
        <Segmented
          options={[
            { value: 'all', label: 'Active', count: stats.total - stats.archived },
            { value: 'pinned', label: 'Pinned', count: stats.pinned },
            { value: 'archived', label: 'Archived', count: stats.archived },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </Card>

      {allTags.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Tags</span>
          {allTags.map((entry) => (
            <Tag key={entry} active={tag === entry} onClick={() => setTag(tag === entry ? null : entry)}>
              {entry}
            </Tag>
          ))}
          {tag ? (
            <button type="button" onClick={() => setTag(null)} className="text-[11px] text-fg-subtle underline">
              clear
            </button>
          ) : null}
        </div>
      ) : null}

      {notes.length ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
          <Card padded={false} className="max-h-[70vh] overflow-y-auto">
            <ul className="divide-y divide-line">
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(note.id)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors',
                      selected?.id === note.id ? 'bg-brand-soft' : 'hover:bg-surface-3',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {note.pinned ? <IconPin size={13} className="mt-0.5 shrink-0 text-warn" /> : null}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">{note.title}</span>
                      {note.archived ? <Badge tone="neutral">archived</Badge> : null}
                    </span>
                    <span className="line-clamp-2 text-[11.5px] text-fg-muted">{stripMarkdown(note.content, 110)}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {note.topic ? <Badge tone="info">{truncate(note.topic, 24)}</Badge> : null}
                      {note.tags.slice(0, 3).map((entry) => (
                        <span key={entry} className="font-mono text-[10px] text-fg-subtle">
                          #{entry}
                        </span>
                      ))}
                      <span className="ml-auto text-[10px] text-fg-subtle">{relativeTime(note.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected ? (
            <SectionCard
              icon={<IconNote size={15} />}
              title={selected.title}
              subtitle={`${selected.topic || 'Unfiled'} · updated ${formatTimestamp(selected.updatedAt)}`}
              action={
                <>
                  <IconButton
                    label={selected.pinned ? 'Unpin note' : 'Pin note'}
                    variant={selected.pinned ? 'subtle' : 'ghost'}
                    icon={<IconPin size={14} />}
                    onClick={() => void store.updateNote(selected.id, { pinned: !selected.pinned })}
                  />
                  <IconButton
                    label={selected.archived ? 'Unarchive note' : 'Archive note'}
                    icon={<IconArchive size={14} />}
                    onClick={() => void store.updateNote(selected.id, { archived: !selected.archived })}
                  />
                  <IconButton
                    label="Copy markdown"
                    icon={<IconCopy size={14} />}
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(selected.content)
                        .then(() => store.toast({ title: 'Markdown copied', tone: 'ok' }))
                        .catch(() => store.toast({ title: 'Clipboard unavailable', tone: 'warn' }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconPencil size={13} />}
                    onClick={() => {
                      setEditing(selected);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <IconButton
                    label="Delete note"
                    icon={<IconTrash size={14} />}
                    onClick={() => deleteNote(selected)}
                  />
                </>
              }
              bodyClassName="px-5 py-5"
              className="max-h-[70vh] overflow-hidden"
            >
              <div className="flex max-h-[52vh] flex-col gap-4 overflow-y-auto">
                {selected.tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((entry) => (
                      <span
                        key={entry}
                        className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-fg-muted"
                      >
                        #{entry}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="prose-note" dangerouslySetInnerHTML={{ __html: html || '<p>This note is empty.</p>' }} />
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<IconNote size={20} />}
            title={state.notes.length ? 'No notes match your filters' : 'No notes yet'}
            description={
              state.notes.length
                ? 'Clear the search, tag or status filter to see your notes again.'
                : 'Write the note you wish you had when you first learned Kubernetes Services — definition, commands, mistakes, interview questions.'
            }
            action={
              <>
                <Button
                  variant="primary"
                  icon={<IconPlus size={15} />}
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  Write a note
                </Button>
                <Link to="/assistant">
                  <Button variant="secondary" icon={<IconSparkles size={15} />}>
                    Generate with AI
                  </Button>
                </Link>
              </>
            }
          />
        </Card>
      )}

      <NoteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} note={editing} />
    </PageBody>
  );
}
