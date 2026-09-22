import { useEffect, useMemo, useState } from 'react';
import { store, useApp } from '@/store/store';
import { projectProgress } from '@/lib/progress';
import { PROJECT_STATUS_META, type Project, type ProjectStatus } from '@/types';
import { diffDays, formatDate, todayISO } from '@/lib/date';
import { cn, sum, uid } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  ProgressRing,
  SectionCard,
  Segmented,
  StatCard,
} from '@/components/ui/primitives';
import { Input, SearchInput, Select } from '@/components/ui/form';
import { ProjectDialog } from '@/features/shared/ProjectDialog';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconAlert,
  IconCheck,
  IconExternalLink,
  IconFolder,
  IconPencil,
  IconPlus,
  IconStar,
  IconTarget,
  IconTrash,
} from '@/components/icons';

type SortKey = 'progress' | 'deadline' | 'name';

export function ProjectsPage() {
  const state = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [sort, setSort] = useState<SortKey>('deadline');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});

  const [newParam, setNewParam] = useQueryFlag('new');
  const [focusParam, setFocusParam] = useQueryFlag('focus');

  useEffect(() => {
    if (newParam === 'project') {
      setEditing(null);
      setDialogOpen(true);
      setNewParam(undefined);
    }
  }, [newParam, setNewParam]);

  useEffect(() => {
    if (!focusParam) return;
    setFocusId(focusParam);
    const element = document.querySelector(`[data-project-id="${focusParam}"]`);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFocusParam(undefined);
  }, [focusParam, setFocusParam]);

  const projects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return state.projects
      .filter((project) => (statusFilter === 'all' ? true : project.status === statusFilter))
      .filter((project) =>
        needle
          ? [project.name, project.description, project.technologies.join(' '), project.tasks.map((task) => task.title).join(' ')]
              .join(' ')
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'deadline') return a.targetDate.localeCompare(b.targetDate);
        return projectProgress(b) - projectProgress(a);
      });
  }, [state.projects, search, statusFilter, sort]);

  const totals = useMemo(() => {
    const tasks = state.projects.flatMap((project) => project.tasks);
    return {
      total: state.projects.length,
      active: state.projects.filter((project) => project.status === 'in-progress').length,
      completed: state.projects.filter((project) => project.status === 'completed').length,
      tasks: tasks.length,
      done: tasks.filter((task) => task.done).length,
      average: state.projects.length
        ? Math.round(sum(state.projects.map((project) => projectProgress(project))) / state.projects.length)
        : 0,
      overdue: state.projects.filter(
        (project) => project.status !== 'completed' && project.targetDate < todayISO(),
      ).length,
    };
  }, [state.projects]);

  const addTask = async (project: Project) => {
    const title = (taskDrafts[project.id] ?? '').trim();
    if (!title) return;
    await store.updateProject(project.id, {
      tasks: [...project.tasks, { id: uid('ptk'), title, done: false }],
    });
    setTaskDrafts((drafts) => ({ ...drafts, [project.id]: '' }));
  };

  const deleteProject = (project: Project) => {
    store.requestConfirmation({
      title: 'Delete project?',
      message: `“${project.name}” and its ${project.tasks.length} checklist item(s) will be removed.`,
      confirmLabel: 'Delete project',
      tone: 'danger',
      onConfirm: async () => {
        await store.deleteProject(project.id);
        store.toast({ title: 'Project deleted', message: project.name, tone: 'info' });
      },
    });
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Project tracker"
        title="Projects"
        description="Portfolio projects are the strongest signal in a DevOps interview. Track the checklist, not just the idea."
        actions={
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add project
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projects"
          value={totals.total}
          hint={`${totals.active} in progress · ${totals.completed} completed`}
          icon={<IconFolder size={16} />}
          tone="brand"
        />
        <StatCard
          label="Average progress"
          value={`${totals.average}%`}
          hint="Mean completion across projects"
          icon={<IconTarget size={16} />}
          tone="accent"
          footer={<ProgressBar value={totals.average} />}
        />
        <StatCard
          label="Deliverables"
          value={`${totals.done}/${totals.tasks}`}
          hint={`${Math.max(0, totals.tasks - totals.done)} checklist item(s) remaining`}
          icon={<IconCheck size={16} />}
          tone="ok"
        />
        <StatCard
          label="Past target date"
          value={totals.overdue}
          hint={totals.overdue ? 'Reschedule or scope these down' : 'Every project is inside its window'}
          icon={<IconAlert size={16} />}
          tone={totals.overdue ? 'danger' : 'ok'}
        />
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects, tech, tasks…" className="min-w-56 flex-1" />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ProjectStatus)} className="w-40">
          <option value="all">All statuses</option>
          {PROJECT_STATUS_META.map((meta) => (
            <option key={meta.value} value={meta.value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Segmented
          options={[
            { value: 'deadline', label: 'Deadline' },
            { value: 'progress', label: 'Progress' },
            { value: 'name', label: 'A–Z' },
          ]}
          value={sort}
          onChange={setSort}
          size="sm"
        />
      </Card>

      {projects.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => {
            const progress = projectProgress(project);
            const meta = PROJECT_STATUS_META.find((entry) => entry.value === project.status);
            const daysLeft = diffDays(todayISO(), project.targetDate);
            const overdue = daysLeft < 0 && project.status !== 'completed';
            const highlighted = project.id === focusId;

            return (
              <Card
                key={project.id}
                interactive
                data-project-id={project.id}
                className={cn('flex flex-col gap-4', highlighted && 'border-brand')}
              >
                <div className="flex items-start gap-4">
                  <ProgressRing value={progress} size={72} strokeWidth={7}>
                    <span className="font-mono text-[13px] font-semibold text-fg">{progress}%</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-[14.5px] font-semibold text-fg" title={project.name}>
                        {project.name}
                      </h3>
                      <Badge tone={meta?.tone ?? 'neutral'}>{meta?.label ?? project.status}</Badge>
                    </div>
                    {project.description ? (
                      <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">{project.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
                      <span>
                        {formatDate(project.startDate, 'short')} → {formatDate(project.targetDate, 'short')}
                      </span>
                      <span className={cn('font-medium', overdue ? 'text-danger' : daysLeft <= 7 ? 'text-warn' : 'text-fg-subtle')}>
                        {project.status === 'completed'
                          ? 'Delivered'
                          : overdue
                            ? `${Math.abs(daysLeft)} day(s) overdue`
                            : `${daysLeft} day(s) left`}
                      </span>
                    </div>
                  </div>
                </div>

                {project.technologies.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {project.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                      Checklist
                    </span>
                    <span className="font-mono text-[11px] text-fg-muted">
                      {project.tasks.filter((task) => task.done).length}/{project.tasks.length}
                    </span>
                  </div>

                  {project.tasks.length ? (
                    <ul className="flex flex-col gap-1">
                      {project.tasks.map((task) => (
                        <li
                          key={task.id}
                          className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-3"
                        >
                          <button
                            type="button"
                            aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                            onClick={() => void store.toggleProjectTask(project.id, task.id)}
                            className={cn(
                              'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors',
                              task.done ? 'border-ok bg-ok text-white' : 'border-line-strong text-transparent hover:border-ok',
                            )}
                          >
                            <IconCheck size={11} strokeWidth={3} />
                          </button>
                          <span className={cn('min-w-0 flex-1 text-[12.5px]', task.done ? 'text-fg-subtle line-through' : 'text-fg')}>
                            {task.title}
                          </span>
                          <IconButton
                            label={`Remove ${task.title}`}
                            size="sm"
                            className="opacity-0 group-hover:opacity-100"
                            icon={<IconTrash size={12} />}
                            onClick={() =>
                              void store.updateProject(project.id, {
                                tasks: project.tasks.filter((entry) => entry.id !== task.id),
                              })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11.5px] text-fg-subtle">No checklist items yet.</p>
                  )}

                  <div className="mt-2 flex gap-2">
                    <Input
                      value={taskDrafts[project.id] ?? ''}
                      placeholder="Add a deliverable…"
                      className="h-8 text-[12px]"
                      onChange={(event) => setTaskDrafts((drafts) => ({ ...drafts, [project.id]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void addTask(project);
                      }}
                    />
                    <Button size="sm" variant="secondary" onClick={() => void addTask(project)}>
                      Add
                    </Button>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-1.5 border-t border-line pt-3">
                  {project.repoUrl ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<IconExternalLink size={13} />}
                      onClick={() => window.open(project.repoUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Repository
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                      <IconStar size={12} />
                      No repo linked yet
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    <IconButton
                      label={`Edit ${project.name}`}
                      size="sm"
                      icon={<IconPencil size={13} />}
                      onClick={() => {
                        setEditing(project);
                        setDialogOpen(true);
                      }}
                    />
                    <IconButton
                      label={`Delete ${project.name}`}
                      size="sm"
                      icon={<IconTrash size={13} />}
                      onClick={() => deleteProject(project)}
                    />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<IconFolder size={20} />}
            title={state.projects.length ? 'No projects match your filters' : 'No projects yet'}
            description={
              state.projects.length
                ? 'Adjust the search or status filter to find your project.'
                : 'Start with a Docker Compose three-tier app, then move it to Kubernetes. Small, finished projects beat big, abandoned ones.'
            }
            action={
              <Button
                variant="primary"
                icon={<IconPlus size={15} />}
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                Add project
              </Button>
            }
          />
        </Card>
      )}

      <SectionCard
        icon={<IconTarget size={15} />}
        title="Deadline radar"
        subtitle="What needs attention in the next two weeks"
        bodyClassName="px-5 py-4"
      >
        {state.projects.length ? (
          <ul className="flex flex-col gap-2">
            {[...state.projects]
              .filter((project) => project.status !== 'completed')
              .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
              .slice(0, 5)
              .map((project) => {
                const daysLeft = diffDays(todayISO(), project.targetDate);
                return (
                  <li key={project.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                    <span className="min-w-40 flex-1 truncate text-[12.5px] font-medium text-fg">{project.name}</span>
                    <Badge tone={daysLeft < 0 ? 'danger' : daysLeft <= 7 ? 'warn' : 'neutral'}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                    </Badge>
                    <span className="hidden w-28 sm:block">
                      <ProgressBar value={projectProgress(project)} height={5} />
                    </span>
                    <span className="w-9 text-right font-mono text-[11px] text-fg-muted">{projectProgress(project)}%</span>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="text-[12.5px] text-fg-muted">No projects to track yet.</p>
        )}
      </SectionCard>

      <ProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} project={editing} />
    </PageBody>
  );
}
