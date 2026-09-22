import { useEffect, useState } from 'react';
import type { Priority, StudyTask, TaskStatus } from '@/types';
import { PRIORITIES, PRIORITY_META, STUDY_SUBJECTS, TASK_STATUSES, TASK_STATUS_META } from '@/types';
import { store, useApp } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/primitives';
import { Field, FormActions, FormGrid, Input, Select, Textarea } from '@/components/ui/form';
import { todayISO } from '@/lib/date';
import { categoriesForSubject } from '@/lib/progress';

export interface TaskFormValues {
  title: string;
  date: string;
  subject: string;
  topic: string;
  plannedMinutes: number;
  actualMinutes: number;
  priority: Priority;
  status: TaskStatus;
  notes: string;
}

function emptyTask(defaults: Partial<StudyTask> = {}): TaskFormValues {
  return {
    title: defaults.title ?? '',
    date: defaults.date ?? todayISO(),
    subject: defaults.subject ?? 'DevOps',
    topic: defaults.topic ?? '',
    plannedMinutes: defaults.plannedMinutes ?? 60,
    actualMinutes: defaults.actualMinutes ?? 0,
    priority: defaults.priority ?? 'medium',
    status: defaults.status ?? 'pending',
    notes: defaults.notes ?? '',
  };
}

export function TaskDialog({
  open,
  onClose,
  task,
  defaults,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided the dialog edits this task, otherwise it creates a new one. */
  task?: StudyTask | null;
  defaults?: Partial<StudyTask>;
  onSaved?: (task: StudyTask) => void;
}) {
  const { topics } = useApp();
  const [values, setValues] = useState<TaskFormValues>(() => emptyTask(task ?? defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(task ? emptyTask(task) : emptyTask(defaults));
    setErrors({});
  }, [open, task, defaults]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const subjectCategories = new Set(categoriesForSubject(values.subject));
  const subjectTopics = topics.filter((topic) => subjectCategories.has(topic.category));

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!values.title.trim()) nextErrors.title = 'Give the task a title.';
    if (values.plannedMinutes <= 0) nextErrors.plannedMinutes = 'Planned duration must be greater than zero.';
    if (values.actualMinutes < 0) nextErrors.actualMinutes = 'Actual duration cannot be negative.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      if (task) {
        await store.updateTask(task.id, { ...values, title: values.title.trim() });
        store.toast({ title: 'Task updated', message: values.title.trim(), tone: 'ok' });
        onSaved?.({ ...task, ...values });
      } else {
        const created = await store.addTask({
          ...values,
          title: values.title.trim(),
          topic: values.topic || values.subject,
        });
        store.toast({ title: 'Task added', message: `${created.title} · ${created.date}`, tone: 'ok' });
        onSaved?.(created);
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
      title={task ? 'Edit task' : 'New study task'}
      description={task ? 'Update the plan, progress or notes for this task.' : 'Plan a focused block of study time.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Task" required error={errors.title}>
          <Input
            autoFocus
            value={values.title}
            invalid={Boolean(errors.title)}
            placeholder="e.g. Kubernetes Service types"
            onChange={(event) => set('title', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
          />
        </Field>

        <FormGrid>
          <Field label="Date" htmlFor="task-date">
            <Input id="task-date" type="date" value={values.date} onChange={(event) => set('date', event.target.value)} />
          </Field>
          <Field label="Subject">
            <Select value={values.subject} onChange={(event) => set('subject', event.target.value)}>
              {STUDY_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Topic" hint="Optional — link it to a tracked topic.">
            <Input
              value={values.topic}
              list="task-topic-suggestions"
              placeholder={values.subject}
              onChange={(event) => set('topic', event.target.value)}
            />
            <datalist id="task-topic-suggestions">
              {subjectTopics.map((topic) => (
                <option key={topic.id} value={topic.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Priority">
            <Select value={values.priority} onChange={(event) => set('priority', event.target.value as Priority)}>
              {PRIORITY_META.map((meta) => (
                <option key={meta.value} value={meta.value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Planned duration" error={errors.plannedMinutes} hint="In minutes.">
            <Input
              type="number"
              min={5}
              step={5}
              value={values.plannedMinutes}
              invalid={Boolean(errors.plannedMinutes)}
              onChange={(event) => set('plannedMinutes', Number(event.target.value))}
            />
          </Field>
          <Field label="Actual duration" error={errors.actualMinutes} hint="Fill in when you finish.">
            <Input
              type="number"
              min={0}
              step={5}
              value={values.actualMinutes}
              invalid={Boolean(errors.actualMinutes)}
              onChange={(event) => set('actualMinutes', Number(event.target.value))}
            />
          </Field>
        </FormGrid>

        <Field label="Status">
          <Select value={values.status} onChange={(event) => set('status', event.target.value as TaskStatus)}>
            {TASK_STATUS_META.map((meta) => (
              <option key={meta.value} value={meta.value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes" hint="Commands you ran, blockers, next steps…">
          <Textarea
            value={values.notes}
            placeholder="docker network inspect bridge …"
            onChange={(event) => set('notes', event.target.value)}
          />
        </Field>

        <p className="text-[11.5px] text-fg-subtle">
          Priorities available: {PRIORITIES.join(', ')} · Statuses: {TASK_STATUSES.join(', ')}
        </p>
        <FormActions>
          <span className="mr-auto text-[11.5px] text-fg-subtle">
            Tip: press <span className="font-mono">Ctrl</span>+<span className="font-mono">K</span> to add tasks from the
            command palette.
          </span>
        </FormActions>
      </div>
    </Modal>
  );
}
