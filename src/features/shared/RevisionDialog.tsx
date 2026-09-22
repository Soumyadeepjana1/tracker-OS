import { useEffect, useState } from 'react';
import type { Confidence, Topic } from '@/types';
import { store, useApp } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/primitives';
import { Field, Input, Textarea } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  1: 'Lost — needs a full re-learn',
  2: 'Shaky — I needed the notes',
  3: 'Getting there — some hesitation',
  4: 'Solid — I could explain it',
  5: 'Mastered — could teach it',
};

export function RevisionDialog({
  open,
  onClose,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  topic?: Topic | null;
}) {
  const { topics } = useApp();
  const [topicId, setTopicId] = useState('');
  const [confidence, setConfidence] = useState<Confidence>(3);
  const [minutes, setMinutes] = useState(25);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTopicId(topic?.id ?? topics[0]?.id ?? '');
    setConfidence(topic?.confidence ?? 3);
    setMinutes(25);
    setNotes(topic?.notes ?? '');
  }, [open, topics, topic]);

  const selected = topics.find((entry) => entry.id === topicId) ?? null;

  const submit = async () => {
    const target = selected ?? topic;
    if (!target) {
      store.toast({ title: 'Pick a topic', message: 'Add a topic first, then log revisions.', tone: 'warn' });
      return;
    }
    setSaving(true);
    try {
      await store.logRevision({
        topicId: target.id,
        topicName: target.name,
        confidence,
        minutes,
        notes,
      });
      store.toast({
        title: 'Revision logged',
        message: `${target.name} · confidence ${confidence}/5`,
        tone: 'ok',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a revision"
      description="Confidence drives the next revision date using a spaced-repetition ladder."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Save revision
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Topic" required>
          <select
            value={topicId}
            onChange={(event) => {
              setTopicId(event.target.value);
              const next = topics.find((entry) => entry.id === event.target.value);
              if (next) setConfidence(next.confidence);
            }}
            className="h-10 w-full cursor-pointer rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            {topics.length ? null : <option value="">No topics yet</option>}
            {topics.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} · {entry.category} · {entry.progress}%
              </option>
            ))}
          </select>
        </Field>

        <Field label="How confident are you now?">
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as Confidence[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setConfidence(level)}
                className={cn(
                  'flex h-11 flex-1 min-w-14 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-all',
                  confidence === level
                    ? level >= 4
                      ? 'border-ok bg-ok-soft text-ok'
                      : level === 3
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-danger bg-danger-soft text-danger'
                    : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong',
                )}
              >
                {level}
                <span className="text-[9.5px] font-normal">/5</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-fg-subtle">{CONFIDENCE_LABELS[confidence]}</p>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Minutes spent">
            <Input type="number" min={1} step={5} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
          </Field>
          <Field label="Next revision in">
            <Input
              readOnly
              value={(() => {
                const ladder = [1, 2, 4, 7, 14, 30];
                const count = selected?.revisionCount ?? 0;
                const days = Math.round(ladder[confidence] * (1 + Math.min(count, 4) * 0.25));
                return `${days} day(s)`;
              })()}
            />
          </Field>
        </div>

        <Field label="What still feels unclear?">
          <Textarea
            value={notes}
            placeholder="Still fuzzy on how kube-proxy programs the iptables rules…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
