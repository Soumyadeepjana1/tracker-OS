import { useEffect, useMemo, useState } from 'react';
import { store, useApp } from '@/store/store';
import { courseCounts } from '@/lib/progress';
import { COURSE_STATUS_META, type Course, type CourseStatus } from '@/types';
import { addDays, formatDate, todayISO } from '@/lib/date';
import { cn, formatMinutes, sum } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar, SectionCard, Segmented, StatCard } from '@/components/ui/primitives';
import { SearchInput, Select } from '@/components/ui/form';
import { CourseDialog } from '@/features/shared/CourseDialog';
import { CourseDetailModal } from './CourseDetailModal';
import { useQueryFlag } from '@/lib/hooks';
import {
  IconBook,
  IconCheckCircle,
  IconClock,
  IconExternalLink,
  IconPencil,
  IconPlus,
  IconTrash,
  IconTrendingUp,
} from '@/components/icons';

type StatusFilter = 'all' | CourseStatus;
type SortKey = 'recent' | 'progress' | 'name';

export function CoursesPage() {
  const state = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('progress');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [newParam, setNewParam] = useQueryFlag('new');
  const [focusParam, setFocusParam] = useQueryFlag('focus');

  useEffect(() => {
    if (newParam === 'course') {
      setEditing(null);
      setDialogOpen(true);
      setNewParam(undefined);
    }
  }, [newParam, setNewParam]);

  useEffect(() => {
    if (!focusParam) return;
    setDetailId(focusParam);
    setFocusParam(undefined);
  }, [focusParam, setFocusParam]);

  const courses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return state.courses
      .filter((course) => (statusFilter === 'all' ? true : course.status === statusFilter))
      .filter((course) =>
        needle
          ? [course.name, course.instructor, course.platform, course.category, course.notes]
              .join(' ')
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'recent') return b.updatedAt.localeCompare(a.updatedAt);
        return courseCounts(b).progress - courseCounts(a).progress;
      });
  }, [state.courses, search, statusFilter, sort]);

  const detailCourse = detailId ? state.courses.find((course) => course.id === detailId) ?? null : null;

  const totals = useMemo(() => {
    const counts = state.courses.map(courseCounts);
    return {
      courses: state.courses.length,
      active: state.courses.filter((course) => course.status === 'in-progress').length,
      completed: state.courses.filter((course) => course.status === 'completed').length,
      modules: sum(counts.map((entry) => entry.totalModules)),
      completedModules: sum(counts.map((entry) => entry.completedModules)),
      progress: state.courses.length
        ? Math.round(sum(counts.map((entry) => entry.progress)) / state.courses.length)
        : 0,
      lessonMinutes: sum(
        state.courses.flatMap((course) => course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.durationMinutes))),
      ),
    };
  }, [state.courses]);

  const deleteCourse = (course: Course) => {
    store.requestConfirmation({
      title: 'Delete course?',
      message: `“${course.name}” will be removed, including its ${course.modules.length} module(s).`,
      confirmLabel: 'Delete course',
      tone: 'danger',
      onConfirm: async () => {
        await store.deleteCourse(course.id);
        store.toast({ title: 'Course deleted', message: course.name, tone: 'info' });
      },
    });
  };

  const bumpModule = async (course: Course, delta: number) => {
    const counts = courseCounts(course);
    const next = Math.max(0, Math.min(counts.totalModules, counts.completedModules + delta));
    const status: CourseStatus = next >= counts.totalModules && counts.totalModules > 0 ? 'completed' : 'in-progress';
    await store.updateCourse(course.id, { completedModules: next, status });
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Course tracker"
        title="Courses"
        description="Track every course, bootcamp and video series you are working through — by module count, or with a full lesson breakdown."
        actions={
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add course
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Courses"
          value={totals.courses}
          hint={`${totals.active} in progress · ${totals.completed} completed`}
          icon={<IconBook size={16} />}
          tone="brand"
        />
        <StatCard
          label="Average progress"
          value={`${totals.progress}%`}
          hint="Mean completion across all courses"
          icon={<IconTrendingUp size={16} />}
          tone="accent"
          footer={<ProgressBar value={totals.progress} />}
        />
        <StatCard
          label="Modules"
          value={`${totals.completedModules}/${totals.modules}`}
          hint={`${Math.max(0, totals.modules - totals.completedModules)} modules remaining`}
          icon={<IconCheckCircle size={16} />}
          tone="ok"
        />
        <StatCard
          label="Lesson content"
          value={totals.lessonMinutes ? formatMinutes(totals.lessonMinutes) : '—'}
          hint="Total runtime of the lessons you have broken down"
          icon={<IconClock size={16} />}
          tone="info"
        />
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search courses, instructors, platforms…"
          className="min-w-60 flex-1"
        />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="w-40">
          <option value="all">All statuses</option>
          {COURSE_STATUS_META.map((meta) => (
            <option key={meta.value} value={meta.value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Segmented
          options={[
            { value: 'progress', label: 'Progress' },
            { value: 'recent', label: 'Recent' },
            { value: 'name', label: 'A–Z' },
          ]}
          value={sort}
          onChange={setSort}
          size="sm"
        />
      </Card>

      {courses.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const counts = courseCounts(course);
            const meta = COURSE_STATUS_META.find((entry) => entry.value === course.status);
            const overdue = course.status !== 'completed' && course.modules.length === 0;
            return (
              <Card key={course.id} interactive className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-fg" title={course.name}>
                      {course.name}
                    </h3>
                    <p className="truncate text-[11.5px] text-fg-subtle">
                      {course.platform || 'Self paced'}
                      {course.instructor ? ` · ${course.instructor}` : ''}
                    </p>
                  </div>
                  <Badge tone={meta?.tone ?? 'neutral'}>{meta?.label ?? course.status}</Badge>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11.5px] text-fg-muted">
                    <span>
                      {counts.completedModules}/{counts.totalModules} modules
                      {counts.totalLessons ? ` · ${counts.completedLessons}/${counts.totalLessons} lessons` : ''}
                    </span>
                    <span className="font-mono font-semibold text-fg">{counts.progress}%</span>
                  </div>
                  <ProgressBar value={counts.progress} className="mt-1.5" />
                </div>

                {counts.totalLessons === 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={counts.completedModules <= 0}
                      onClick={() => void bumpModule(course, -1)}
                    >
                      − module
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={counts.completedModules >= counts.totalModules}
                      onClick={() => void bumpModule(course, 1)}
                    >
                      + module
                    </Button>
                    <span className="ml-auto text-[11px] text-fg-subtle">
                      {counts.remainingModules} left
                    </span>
                  </div>
                ) : (
                  <p className="text-[11.5px] text-fg-subtle">
                    {counts.remainingModules} module(s) remaining · structured lesson tracking enabled
                  </p>
                )}

                {course.notes ? (
                  <p className="line-clamp-2 text-[11.5px] text-fg-muted">{course.notes}</p>
                ) : null}

                {overdue ? (
                  <p className="text-[11px] text-warn">
                    No lesson breakdown yet — open the course to add modules for accurate tracking.
                  </p>
                ) : null}

                <div className="mt-auto flex items-center gap-1.5 border-t border-line pt-3">
                  <Button size="sm" variant="secondary" onClick={() => setDetailId(course.id)}>
                    Open
                  </Button>
                  {course.url ? (
                    <IconButton
                      label="Open course link"
                      size="sm"
                      icon={<IconExternalLink size={13} />}
                      onClick={() => window.open(course.url, '_blank', 'noopener,noreferrer')}
                    />
                  ) : null}
                  <span className="ml-auto flex items-center gap-1">
                    <IconButton
                      label={`Edit ${course.name}`}
                      size="sm"
                      icon={<IconPencil size={13} />}
                      onClick={() => {
                        setEditing(course);
                        setDialogOpen(true);
                      }}
                    />
                    <IconButton
                      label={`Delete ${course.name}`}
                      size="sm"
                      icon={<IconTrash size={13} />}
                      onClick={() => deleteCourse(course)}
                    />
                  </span>
                </div>
                <p className="text-[10.5px] text-fg-subtle">
                  Updated {formatDate(course.updatedAt.slice(0, 10), 'short')}
                </p>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<IconBook size={20} />}
            title={state.courses.length ? 'No courses match your filters' : 'No courses yet'}
            description={
              state.courses.length
                ? 'Try a different search term or switch the status filter back to “All statuses”.'
                : 'Add the course you are working through right now — even a rough module count is useful.'
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
                Add course
              </Button>
            }
          />
        </Card>
      )}

      <SectionCard
        icon={<IconTrendingUp size={15} />}
        title="Up next"
        subtitle="Courses closest to completion, and the ones you have not touched in a while"
        bodyClassName="px-5 py-4"
      >
        {state.courses.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...state.courses]
              .sort((a, b) => courseCounts(b).progress - courseCounts(a).progress)
              .slice(0, 3)
              .map((course) => (
                <div key={course.id} className={cn('rounded-xl border border-line bg-surface-2 p-3.5')}>
                  <p className="truncate text-[12.5px] font-medium text-fg">{course.name}</p>
                  <p className="mt-0.5 text-[11px] text-fg-subtle">
                    {courseCounts(course).remainingModules} module(s) to go · target{' '}
                    {formatDate(addDays(todayISO(), 14), 'short')} pace check
                  </p>
                  <ProgressBar value={courseCounts(course).progress} className="mt-2" height={5} />
                </div>
              ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-fg-muted">Nothing to show yet.</p>
        )}
      </SectionCard>

      <CourseDialog open={dialogOpen} onClose={() => setDialogOpen(false)} course={editing} />
      <CourseDetailModal
        course={detailCourse}
        open={Boolean(detailCourse)}
        onClose={() => setDetailId(null)}
        onEdit={(course) => {
          setDetailId(null);
          setEditing(course);
          setDialogOpen(true);
        }}
      />
    </PageBody>
  );
}
