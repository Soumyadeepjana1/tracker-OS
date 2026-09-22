import { useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '@/types';
import { store, useApp } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button, Segmented } from '@/components/ui/primitives';
import { Checkbox, Field, FormGrid, Input, TagInput, Textarea } from '@/components/ui/form';
import { renderMarkdown, extractTags } from '@/lib/markdown';

const NOTE_TEMPLATE = `## Definition

## Commands

\`\`\`bash

\`\`\`

## Example

## Common mistakes

## Interview questions

## My notes
`;

export function NoteDialog({
  open,
  onClose,
  note,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  note?: Note | null;
  defaults?: Partial<Note>;
}) {
  const { topics, notes } = useApp();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    if (!open) return;
    const source = note ?? defaultsRef.current;
    setTitle(source?.title ?? '');
    setTopic(source?.topic ?? '');
    setTags(source?.tags ?? []);
    setContent(source?.content ?? '');
    setPinned(source?.pinned ?? false);
    setArchived(source?.archived ?? false);
    setTab('write');
    setError('');
  }, [open, note]);

  const html = useMemo(() => renderMarkdown(content), [content]);
  const tagSuggestions = useMemo(
    () => Array.from(new Set(notes.flatMap((entry) => entry.tags))).slice(0, 8),
    [notes],
  );

  const submit = async () => {
    if (!title.trim()) {
      setError('A note needs a title.');
      return;
    }
    setSaving(true);
    try {
      // #hashtags typed in the body are folded into the tag list automatically.
      const inlineTags = extractTags(content);
      const mergedTags = Array.from(new Set([...tags, ...inlineTags]));

      if (note) {
        await store.updateNote(note.id, {
          title: title.trim(),
          topic,
          tags: mergedTags,
          content,
          pinned,
          archived,
        });
        store.toast({ title: 'Note saved', message: title.trim(), tone: 'ok' });
      } else {
        await store.addNote({
          title: title.trim(),
          topic,
          tags: mergedTags,
          content,
          pinned,
          archived,
        });
        store.toast({ title: 'Note created', message: title.trim(), tone: 'ok' });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={note ? 'Edit note' : 'New note'}
      description="Markdown supported: headings, lists, code fences, tables, links."
      footer={
        <>
          <Checkbox checked={pinned} onChange={setPinned} label="Pin" className="mr-auto" />
          <Checkbox checked={archived} onChange={setArchived} label="Archive" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {note ? 'Save note' : 'Create note'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormGrid columns={3}>
          <Field label="Title" required error={error} className="sm:col-span-2">
            <Input
              autoFocus
              value={title}
              invalid={Boolean(error)}
              placeholder="Kubernetes Service — complete reference"
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Topic">
            <Input
              value={topic}
              list="note-topic-suggestions"
              placeholder="Kubernetes Service"
              onChange={(event) => setTopic(event.target.value)}
            />
            <datalist id="note-topic-suggestions">
              {topics.map((entry) => (
                <option key={entry.id} value={entry.name} />
              ))}
            </datalist>
          </Field>
        </FormGrid>

        <Field label="Tags" hint="Type and press Enter. #hashtags in the body are picked up too.">
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Segmented
            options={[
              { value: 'write', label: 'Write' },
              { value: 'preview', label: 'Preview' },
            ]}
            value={tab}
            onChange={setTab}
            size="sm"
          />
          {!content.trim() ? (
            <Button variant="ghost" size="sm" onClick={() => setContent(NOTE_TEMPLATE)}>
              Insert interview-ready template
            </Button>
          ) : null}
        </div>

        {tab === 'write' ? (
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={'## Definition\n\n## Commands\n\n```bash\nkubectl get svc\n```'}
            className="min-h-[46vh] font-mono text-[12.5px]"
          />
        ) : (
          <div
            className="prose-note card-base min-h-[46vh] overflow-y-auto p-4"
            dangerouslySetInnerHTML={{ __html: html || '<p>Nothing to preview yet.</p>' }}
          />
        )}
      </div>
    </Modal>
  );
}
