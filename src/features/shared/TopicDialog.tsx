import { useEffect, useState } from 'react';
import type { Confidence, Difficulty, Topic, TopicStatus } from '@/types';
import { DIFFICULTY_META, TOPIC_CATEGORIES, TOPIC_STATUS_META } from '@/types';
import { store, useApp } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button, ProgressBar } from '@/components/ui/primitives';
import { Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { nextRevisionInterval } from '@/lib/progress';
import { addDays, todayISO } from '@/lib/date';
import { cn } from '@/lib/utils';

export function TopicDialog({
  open,
  onClose,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  topic?: Topic | null;
}) {
  const { topics } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Docker');
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState<TopicStatus>('learning');
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState<Confidence>(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [lastStudiedAt, setLastStudiedAt] = useState('');
  const [nextRevisionAt, setNextRevisionAt] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const knownCategory = topic && (TOPIC_CATEGORIES as readonly string[]).includes(topic.category);
    setName(topic?.name ?? '');
    setCategory(topic ? (knownCategory ? topic.category : '__custom') : 'Docker');
    setCustomCategory(topic && !knownCategory ? topic.category : '');
    setStatus(topic?.status ?? 'learning');
    setProgress(topic?.progress ?? 0);
    setConfidence(topic?.confidence ?? 3);
    setDifficulty(topic?.difficulty ?? 'medium');
    setLastStudiedAt(topic?.lastStudiedAt ?? '');
    setNextRevisionAt(topic?.nextRevisionAt ?? '');
    setResourceUrl(topic?.resourceUrl ?? '');
    setNotes(topic?.notes ?? '');
    setError('');
  }, [open, topic]);

  const categories = Array.from(new Set([...TOPIC_CATEGORIES, ...topics.map((entry) => entry.category)]));

  const submit = async () => {
    const resolvedCategory = category === '__custom' ? customCategory.trim() : category;
    if (!name.trim()) {
      setError('Give the topic a name.');
      return;
    }
    if (!resolvedCategory) {
      setError('Pick or type a category.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: resolvedCategory,
        status,
        progress,
        confidence,
        difficulty,
        lastStudiedAt: lastStudiedAt || undefined,
        nextRevisionAt: nextRevisionAt || undefined,
        resourceUrl: resourceUrl.trim(),
        notes,
      };
      if (topic) {
        await store.updateTopic(topic.id, payload);
        store.toast({ title: 'Topic updated', message: name.trim(), tone: 'ok' });
      } else {
        await store.addTopic(payload);
        store.toast({ title: 'Topic added', message: `${name.trim()} · ${resolvedCategory}`, tone: 'ok' });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const suggestedInterval = nextRevisionInterval(confidence, topic?.revisionCount ?? 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={topic ? 'Edit topic' : 'Add topic'}
      description="Topics power your progress bars, revision queue and analytics."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {topic ? 'Save topic' : 'Add topic'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Topic name" required error={error}>
          <Input
            autoFocus
            value={name}
            invalid={Boolean(error)}
            placeholder="Kubernetes Ingress"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <FormGrid>
          <Field label="Category">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
              <option value="__custom">Custom…</option>
            </Select>
          </Field>
          {category === '__custom' ? (
            <Field label="Custom category">
              <Input value={customCategory} placeholder="e.g. Service Mesh" onChange={(event) => setCustomCategory(event.target.value)} />
            </Field>
          ) : null}
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value as TopicStatus)}>
              {TOPIC_STATUS_META.map((meta) => (
                <option key={meta.value} value={meta.value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
              {DIFFICULTY_META.map((meta) => (
                <option key={meta.value} value={meta.value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <Field label={`Mastery — ${progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-[var(--brand)]"
          />
          <ProgressBar value={progress} className="mt-2" />
        </Field>

        <Field label="Confidence">
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as Confidence[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setConfidence(level)}
                className={cn(
                  'h-10 flex-1 min-w-12 rounded-xl border text-sm font-semibold transition-all',
                  confidence === level
                    ? level >= 4
                      ? 'border-ok bg-ok-soft text-ok'
                      : level === 3
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-danger bg-danger-soft text-danger'
                    : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong',
                )}
              >
                {level}/5
              </button>
            ))}
          </div>
        </Field>

        <FormGrid>
          <Field label="Last studied">
            <Input type="date" value={lastStudiedAt} onChange={(event) => setLastStudiedAt(event.target.value)} />
          </Field>
          <Field
            label="Next revision"
            hint={`Suggested: ${addDays(todayISO(), suggestedInterval)} (${suggestedInterval} days)`}
          >
            <div className="flex gap-2">
              <Input type="date" value={nextRevisionAt} onChange={(event) => setNextRevisionAt(event.target.value)} />
              <Button
                variant="secondary"
                type="button"
                onClick={() => setNextRevisionAt(addDays(todayISO(), suggestedInterval))}
              >
                Suggest
              </Button>
            </div>
          </Field>
        </FormGrid>

        <Field label="Resource link">
          <Input value={resourceUrl} placeholder="https://kubernetes.io/docs/…" onChange={(event) => setResourceUrl(event.target.value)} />
        </Field>

        <Field label="Notes">
          <Textarea value={notes} placeholder="What is still unclear?" onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
