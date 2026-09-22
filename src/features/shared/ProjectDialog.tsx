import { useEffect, useRef, useState } from 'react';
import type { Project, ProjectStatus, ProjectTask } from '@/types';
import { PROJECT_STATUS_META } from '@/types';
import { store } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button, IconButton } from '@/components/ui/primitives';
import { Field, FormGrid, Input, Select, TagInput, Textarea } from '@/components/ui/form';
import { IconPlus, IconTrash } from '@/components/icons';
import { addDays, todayISO } from '@/lib/date';
import { uid } from '@/lib/utils';

const TECH_SUGGESTIONS = [
  'Docker',
  'Kubernetes',
  'Terraform',
  'AWS',
  'Prometheus',
  'Grafana',
  'GitHub Actions',
  'Ansible',
  'Python',
  'FastAPI',
  'Java',
  'Spring Boot',
];

export function ProjectDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [targetDate, setTargetDate] = useState(addDays(todayISO(), 30));
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    if (!open) return;
    const seed = projectRef.current;
    setName(seed?.name ?? '');
    setDescription(seed?.description ?? '');
    setTechnologies(seed?.technologies ?? []);
    setRepoUrl(seed?.repoUrl ?? '');
    setStartDate(seed?.startDate ?? todayISO());
    setTargetDate(seed?.targetDate ?? addDays(todayISO(), 30));
    setStatus(seed?.status ?? 'planned');
    setTasks(seed?.tasks ?? []);
    setNewTask('');
    setNotes(seed?.notes ?? '');
    setError('');
  }, [open]);

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    setTasks((current) => [...current, { id: uid('ptk'), title, done: false }]);
    setNewTask('');
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the project a name.');
      return;
    }
    if (targetDate < startDate) {
      setError('The target date cannot be before the start date.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        technologies,
        repoUrl: repoUrl.trim(),
        startDate,
        targetDate,
        status,
        tasks,
        notes,
      };
      if (projectRef.current) {
        await store.updateProject(projectRef.current.id, payload);
        store.toast({ title: 'Project updated', message: name.trim(), tone: 'ok' });
      } else {
        await store.addProject(payload);
        store.toast({ title: 'Project created', message: `${name.trim()} · ${tasks.length} tasks`, tone: 'ok' });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const doneCount = tasks.filter((task) => task.done).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={project ? 'Edit project' : 'Add project'}
      description="Projects are the proof of work — break them into a checklist you can actually finish."
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-fg-subtle">
            {tasks.length ? `${doneCount}/${tasks.length} tasks complete` : 'No tasks yet'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {project ? 'Save project' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Project name" required error={error}>
          <Input
            autoFocus
            value={name}
            invalid={Boolean(error)}
            placeholder="AI Kubernetes Incident Response"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            placeholder="What it does, who it is for, what makes it interesting."
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20"
          />
        </Field>

        <Field label="Technologies" hint="Enter each technology, or pick a suggestion.">
          <TagInput value={technologies} onChange={setTechnologies} suggestions={TECH_SUGGESTIONS} placeholder="Docker, Kubernetes, Prometheus…" />
        </Field>

        <FormGrid columns={3}>
          <Field label="GitHub repository">
            <Input value={repoUrl} placeholder="https://github.com/you/repo" onChange={(event) => setRepoUrl(event.target.value)} />
          </Field>
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Target date">
            <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </Field>
        </FormGrid>

        <Field label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
            {PROJECT_STATUS_META.map((meta) => (
              <option key={meta.value} value={meta.value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Checklist">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={newTask}
                placeholder="Add a deliverable…"
                onChange={(event) => setNewTask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTask();
                  }
                }}
              />
              <Button variant="secondary" icon={<IconPlus size={15} />} onClick={addTask} type="button">
                Add
              </Button>
            </div>
            {tasks.length ? (
              <ul className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2 p-2">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-3">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() =>
                        setTasks((current) =>
                          current.map((entry) => (entry.id === task.id ? { ...entry, done: !entry.done } : entry)),
                        )
                      }
                      className="h-4 w-4 cursor-pointer rounded accent-[var(--brand)]"
                    />
                    <span className={`flex-1 text-[13px] ${task.done ? 'text-fg-subtle line-through' : 'text-fg'}`}>
                      {task.title}
                    </span>
                    <IconButton
                      label={`Remove ${task.title}`}
                      size="sm"
                      icon={<IconTrash size={14} />}
                      onClick={() => setTasks((current) => current.filter((entry) => entry.id !== task.id))}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Field>

        <Field label="Notes">
          <Textarea value={notes} placeholder="Architecture decisions, blockers, links…" onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
