import { useMemo, useState } from 'react';
import type { Course, LessonStatus } from '@/types';
import { LESSON_STATUS_META } from '@/types';
import { store } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Badge, Button, EmptyState, IconButton, ProgressBar, ProgressRing } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';
import { courseCounts, nextRevisionInterval } from '@/lib/progress';
import { addDays, formatDate, todayISO } from '@/lib/date';
import { formatMinutes, cn, uid, sum } from '@/lib/utils';
import {
  IconBook,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@/components/icons';

export function CourseDetailModal({
  course,
  open,
  onClose,
  onEdit,
}: {
  course: Course | null;
  open: boolean;
  onClose: () => void;
  onEdit: (course: Course) => void;
}) {
  const [newModule, setNewModule] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lessonDraft, setLessonDraft] = useState<Record<string, string>>({});

  const counts = useMemo(() => (course ? courseCounts(course) : null), [course]);

  if (!course || !counts) return null;

  const totalLessonMinutes = sum(course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.durationMinutes)));

  const addModule = async () => {
    const title = newModule.trim();
    if (!title) return;
    const current = store.getState().courses.find((entry) => entry.id === course.id);
    if (!current) return;
    await store.updateCourse(course.id, {
      modules: [...current.modules, { id: uid('mod'), title, lessons: [] }],
      totalModules: current.totalModules + 1,
    });
    setNewModule('');
    store.toast({ title: 'Module added', message: title, tone: 'ok' });
  };

  const addLesson = async (moduleId: string) => {
    const title = (lessonDraft[moduleId] ?? '').trim();
    if (!title) return;
    const current = store.getState().courses.find((entry) => entry.id === course.id);
    if (!current) return;
    await store.updateCourse(course.id, {
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lessons: [
                ...module.lessons,
                { id: uid('lsn'), title, durationMinutes: 30, status: 'not-started' as LessonStatus, notes: '', needsRevision: false },
              ],
            }
          : module,
      ),
    });
    setLessonDraft((draft) => ({ ...draft, [moduleId]: '' }));
  };

  const setLessonStatus = async (moduleId: string, lessonId: string, status: LessonStatus) => {
    const current = store.getState().courses.find((entry) => entry.id === course.id);
    if (!current) return;
    await store.updateCourse(course.id, {
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? { ...module, lessons: module.lessons.map((lesson) => (lesson.id === lessonId ? { ...lesson, status } : lesson)) }
          : module,
      ),
    });
  };

  const toggleLessonRevision = async (moduleId: string, lessonId: string, needsRevision: boolean) => {
    const current = store.getState().courses.find((entry) => entry.id === course.id);
    if (!current) return;

    const lesson = current.modules.find((module) => module.id === moduleId)?.lessons.find((entry) => entry.id === lessonId);
    if (needsRevision && lesson) {
      // Flagging a lesson for revision also queues a topic so it reaches the revision page.
      const existing = store.getState().topics.find((topic) => topic.name === lesson.title);
      if (!existing) {
        const confidence = 2;
        await store.addTopic({
          name: lesson.title,
          category: course.category,
          status: 'need-revision',
          progress: 40,
          confidence,
          difficulty: 'medium',
          lastStudiedAt: todayISO(),
          nextRevisionAt: addDays(todayISO(), nextRevisionInterval(confidence, 0)),
          notes: `Flagged from the course “${course.name}”.`,
        });
        store.toast({ title: 'Revision topic created', message: lesson.title, tone: 'ok' });
      }
    }

    await store.updateCourse(course.id, {
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? { ...module, lessons: module.lessons.map((entry) => (entry.id === lessonId ? { ...entry, needsRevision } : entry)) }
          : module,
      ),
    });
  };

  const removeModule = (moduleId: string) => {
    const current = store.getState().courses.find((entry) => entry.id === course.id);
    if (!current) return;
    const module = current.modules.find((entry) => entry.id === moduleId);
    store.requestConfirmation({
      title: 'Delete module?',
      message: `“${module?.title ?? 'This module'}” and its ${module?.lessons.length ?? 0} lesson(s) will be removed.`,
      confirmLabel: 'Delete module',
      tone: 'danger',
      onConfirm: async () => {
        await store.updateCourse(course.id, {
          modules: current.modules.filter((entry) => entry.id !== moduleId),
          totalModules: Math.max(0, current.totalModules - 1),
        });
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={course.name}
      description={`${course.platform || 'Self paced'}${course.instructor ? ` · ${course.instructor}` : ''} · ${counts.completedModules}/${counts.totalModules} modules`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={() => onEdit(course)}>
            Edit details
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-surface-2 p-4">
          <ProgressRing value={counts.progress} size={88} strokeWidth={8}>
            <span className="font-mono text-base font-semibold text-fg">{counts.progress}%</span>
          </ProgressRing>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Modules" value={`${counts.completedModules}/${counts.totalModules}`} />
            <Metric label="Remaining" value={`${counts.remainingModules}`} />
            <Metric label="Lessons" value={counts.totalLessons ? `${counts.completedLessons}/${counts.totalLessons}` : '—'} />
            <Metric label="Content" value={totalLessonMinutes ? formatMinutes(totalLessonMinutes) : '—'} />
          </div>
        </div>

        {course.notes ? (
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12.5px] text-fg-muted whitespace-pre-line">
            {course.notes}
          </div>
        ) : null}

        {course.url ? (
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[12.5px] font-medium text-accent hover:underline"
          >
            <IconExternalLink size={14} />
            Open course material
          </a>
        ) : null}

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-fg">Modules &amp; lessons</h3>
            <div className="flex items-center gap-2">
              <Input
                value={newModule}
                placeholder="New module title…"
                className="h-9 w-48"
                onChange={(event) => setNewModule(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void addModule();
                }}
              />
              <Button size="sm" variant="secondary" icon={<IconPlus size={14} />} onClick={() => void addModule()}>
                Add module
              </Button>
            </div>
          </div>

          {course.modules.length ? (
            <ul className="flex flex-col gap-2">
              {course.modules.map((module) => {
                const isOpen = expanded[module.id] ?? false;
                const done = module.lessons.filter((lesson) => lesson.status === 'completed').length;
                const moduleProgress = module.lessons.length ? Math.round((done / module.lessons.length) * 100) : 0;
                return (
                  <li key={module.id} className="rounded-xl border border-line bg-surface-2">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <IconButton
                        label={isOpen ? 'Collapse module' : 'Expand module'}
                        size="sm"
                        icon={isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                        onClick={() => setExpanded((current) => ({ ...current, [module.id]: !isOpen }))}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-fg">{module.title}</p>
                        <p className="text-[11px] text-fg-subtle">
                          {module.lessons.length} lesson(s) · {done} completed
                        </p>
                      </div>
                      <div className="hidden w-28 sm:block">
                        <ProgressBar value={moduleProgress} height={5} />
                      </div>
                      <Badge tone={moduleProgress >= 100 ? 'ok' : 'neutral'}>{moduleProgress}%</Badge>
                      <IconButton
                        label="Delete module"
                        size="sm"
                        icon={<IconTrash size={13} />}
                        onClick={() => removeModule(module.id)}
                      />
                    </div>

                    {isOpen ? (
                      <div className="border-t border-line px-3 py-2.5">
                        {module.lessons.length ? (
                          <ul className="flex flex-col gap-1">
                            {module.lessons.map((lesson) => {
                              const statusMeta = LESSON_STATUS_META.find((meta) => meta.value === lesson.status);
                              return (
                                <li key={lesson.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-3">
                                  <button
                                    type="button"
                                    aria-label={`Toggle ${lesson.title}`}
                                    onClick={() =>
                                      void setLessonStatus(
                                        module.id,
                                        lesson.id,
                                        lesson.status === 'completed' ? 'not-started' : 'completed',
                                      )
                                    }
                                    className={cn(
                                      'flex shrink-0 items-center justify-center rounded border transition-colors',
                                      lesson.status === 'completed'
                                        ? 'border-ok bg-ok text-white'
                                        : 'border-line-strong text-transparent hover:border-ok',
                                    )}
                                    style={{ height: 18, width: 18 }}
                                  >
                                    <IconCheck size={11} strokeWidth={3} />
                                  </button>
                                  <span
                                    className={cn(
                                      'min-w-0 flex-1 truncate text-[12px]',
                                      lesson.status === 'completed' && !lesson.needsRevision
                                        ? 'text-fg-subtle line-through'
                                        : 'text-fg',
                                    )}
                                  >
                                    {lesson.title}
                                  </span>
                                  <span className="font-mono text-[10.5px] text-fg-subtle">{lesson.durationMinutes}m</span>
                                  <select
                                    value={lesson.status}
                                    onChange={(event) => void setLessonStatus(module.id, lesson.id, event.target.value as LessonStatus)}
                                    aria-label={`Status for ${lesson.title}`}
                                    className={cn(
                                      'h-6 cursor-pointer rounded-md border border-line bg-surface px-1.5 text-[10.5px] font-semibold focus:outline-none',
                                      statusMeta?.tone === 'ok' ? 'text-ok' : statusMeta?.tone === 'info' ? 'text-info' : 'text-fg-muted',
                                    )}
                                  >
                                    {LESSON_STATUS_META.map((meta) => (
                                      <option key={meta.value} value={meta.value}>
                                        {meta.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => void toggleLessonRevision(module.id, lesson.id, !lesson.needsRevision)}
                                    title={lesson.needsRevision ? 'Remove from revision queue' : 'Add to revision queue'}
                                    className={cn(
                                      'flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-semibold transition-colors',
                                      lesson.needsRevision
                                        ? 'border-warn/40 bg-warn-soft text-warn'
                                        : 'border-line text-fg-subtle hover:text-fg',
                                    )}
                                  >
                                    <IconRefresh size={11} />
                                    {lesson.needsRevision ? 'Revision' : 'Revise?'}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="py-1 text-[11.5px] text-fg-subtle">No lessons yet — add the first one below.</p>
                        )}

                        <div className="mt-2 flex gap-2">
                          <Input
                            value={lessonDraft[module.id] ?? ''}
                            placeholder="Add a lesson…"
                            className="h-9"
                            onChange={(event) => setLessonDraft((draft) => ({ ...draft, [module.id]: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') void addLesson(module.id);
                            }}
                          />
                          <Button size="sm" variant="secondary" onClick={() => void addLesson(module.id)}>
                            Add
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<IconBook size={20} />}
              title="Break the course into modules"
              description="Add modules and lessons to get automatic progress tracking instead of a manual module count."
            />
          )}
        </div>

        <p className="text-[11px] text-fg-subtle">
          Created {formatDate(course.createdAt.slice(0, 10))} · last updated {formatDate(course.updatedAt.slice(0, 10))}
        </p>
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-center">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className="mt-0.5 font-mono text-[13.5px] font-semibold text-fg">{value}</p>
    </div>
  );
}
