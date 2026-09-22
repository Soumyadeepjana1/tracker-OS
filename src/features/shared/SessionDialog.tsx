import { useEffect, useRef, useState } from 'react';
import type { StudyTask, TimerMode } from '@/types';
import { STUDY_SUBJECTS } from '@/types';
import { store, useApp } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/primitives';
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';

export interface SessionDialogDefaults {
  minutes?: number;
  subject?: string;
  topic?: string;
  notes?: string;
  mode?: TimerMode;
  /** When finishing a pomodoro, offer to complete this task. */
  taskId?: string;
}

/** "What did you study?" — the dialog shown when a focus session ends. */
export function SessionDialog({
  open,
  onClose,
  defaults,
  title = 'Log study time',
  description = 'Study time feeds your streak, daily target and analytics.',
}: {
  open: boolean;
  onClose: () => void;
  defaults?: SessionDialogDefaults;
  title?: string;
  description?: string;
}) {
  const { tasks } = useApp();
  const [minutes, setMinutes] = useState(defaults?.minutes ?? 25);
  const [subject, setSubject] = useState(defaults?.subject ?? 'DevOps');
  const [topic, setTopic] = useState(defaults?.topic ?? '');
  const [notes, setNotes] = useState(defaults?.notes ?? '');
  const [taskId, setTaskId] = useState<string>('');
  const [completeTask, setCompleteTask] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    if (!open) return;
    const seed = defaultsRef.current;
    setMinutes(seed?.minutes ?? 25);
    setSubject(seed?.subject ?? 'DevOps');
    setTopic(seed?.topic ?? '');
    setNotes(seed?.notes ?? '');
    setTaskId(seed?.taskId ?? '');
    setCompleteTask(Boolean(seed?.taskId));
  }, [open]);

  const mode = defaultsRef.current?.mode ?? 'custom';

  const todayTasks = tasks.filter((task) => task.status !== 'completed').slice(0, 40);

  const submit = async () => {
    if (minutes <= 0) {
      store.toast({ title: 'Duration required', message: 'Enter at least 1 minute.', tone: 'warn' });
      return;
    }
    setSaving(true);
    try {
      await store.addSession({
        minutes: Math.round(minutes),
        subject,
        topic: topic || subject,
        notes,
        mode,
      });

      const task = todayTasks.find((entry) => entry.id === taskId) ?? findById(tasks, taskId);
      if (task && completeTask) {
        await store.updateTask(task.id, { status: 'completed', actualMinutes: Math.round(minutes) });
      } else if (task) {
        await store.updateTask(task.id, { actualMinutes: (task.actualMinutes ?? 0) + Math.round(minutes) });
      }

      store.toast({
        title: `Logged ${Math.round(minutes)} minutes`,
        message: `${subject}${topic ? ` · ${topic}` : ''}`,
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
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Skip
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Save session
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormGrid columns={3}>
          <Field label="Minutes studied" required>
            <Input
              type="number"
              min={1}
              step={5}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </Field>
          <Field label="Subject">
            <Select value={subject} onChange={(event) => setSubject(event.target.value)}>
              {STUDY_SUBJECTS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Topic">
            <Input value={topic} placeholder="What exactly?" onChange={(event) => setTopic(event.target.value)} />
          </Field>
        </FormGrid>

        <Field label="What did you study?" hint="One or two lines you can search later.">
          <Textarea
            autoFocus
            value={notes}
            placeholder="Practised ClusterIP vs NodePort with kubectl expose…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>

        <Field label="Attach to a task" hint="Optional — links the time to a planned task.">
          <Select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            <option value="">No task</option>
            {todayTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.date} · {task.title}
              </option>
            ))}
          </Select>
        </Field>

        {taskId ? (
          <Checkbox
            checked={completeTask}
            onChange={setCompleteTask}
            label="Mark that task as completed"
            hint="The logged minutes become the task's actual duration."
          />
        ) : null}
      </div>
    </Modal>
  );
}

function findById(tasks: StudyTask[], id: string): StudyTask | undefined {
  return tasks.find((task) => task.id === id);
}
