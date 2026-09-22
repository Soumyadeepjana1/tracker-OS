import { useEffect, useState } from 'react';
import type { Course, CourseStatus } from '@/types';
import { COURSE_STATUS_META, STUDY_SUBJECTS } from '@/types';
import { store, useApp } from '@/store/store';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/primitives';
import { Field, FormGrid, Input, Select, Textarea } from '@/components/ui/form';

export function CourseDialog({
  open,
  onClose,
  course,
}: {
  open: boolean;
  onClose: () => void;
  course?: Course | null;
}) {
  const { courses } = useApp();
  const [name, setName] = useState('');
  const [instructor, setInstructor] = useState('');
  const [platform, setPlatform] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<string>('DevOps');
  const [status, setStatus] = useState<CourseStatus>('in-progress');
  const [totalModules, setTotalModules] = useState(10);
  const [completedModules, setCompletedModules] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(course?.name ?? '');
    setInstructor(course?.instructor ?? '');
    setPlatform(course?.platform ?? '');
    setUrl(course?.url ?? '');
    setCategory(course?.category ?? 'DevOps');
    setStatus(course?.status ?? 'in-progress');
    setTotalModules(course?.totalModules ?? 10);
    setCompletedModules(course?.completedModules ?? 0);
    setNotes(course?.notes ?? '');
    setError('');
  }, [open, course]);

  const hasModules = (course?.modules.length ?? 0) > 0;
  const platforms = Array.from(new Set(courses.map((entry) => entry.platform).filter(Boolean))).slice(0, 8);

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the course a name.');
      return;
    }
    if (completedModules > totalModules) {
      setError('Completed modules cannot exceed the total.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        instructor: instructor.trim(),
        platform: platform.trim(),
        url: url.trim(),
        category,
        status,
        totalModules,
        completedModules,
        notes,
      };
      if (course) {
        await store.updateCourse(course.id, payload);
        store.toast({ title: 'Course updated', message: name.trim(), tone: 'ok' });
      } else {
        await store.addCourse(payload);
        store.toast({ title: 'Course added', message: `${name.trim()} · ${totalModules} modules`, tone: 'ok' });
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
      title={course ? 'Edit course' : 'Add course'}
      description="Track progress by module count, or break the course into lessons later."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {course ? 'Save course' : 'Add course'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Course name" required error={error}>
          <Input
            autoFocus
            value={name}
            invalid={Boolean(error)}
            placeholder="TrainWithShubham — Complete DevOps"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <FormGrid>
          <Field label="Instructor">
            <Input value={instructor} placeholder="Shubham Londhe" onChange={(event) => setInstructor(event.target.value)} />
          </Field>
          <Field label="Platform">
            <Input
              value={platform}
              list="course-platform-suggestions"
              placeholder="YouTube / Udemy / KodeKloud"
              onChange={(event) => setPlatform(event.target.value)}
            />
            <datalist id="course-platform-suggestions">
              {platforms.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          </Field>
          <Field label="Link">
            <Input value={url} placeholder="https://…" onChange={(event) => setUrl(event.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {STUDY_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value as CourseStatus)}>
              {COURSE_STATUS_META.map((meta) => (
                <option key={meta.value} value={meta.value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <FormGrid>
          <Field label="Total modules">
            <Input
              type="number"
              min={0}
              value={totalModules}
              onChange={(event) => setTotalModules(Math.max(0, Number(event.target.value)))}
            />
          </Field>
          <Field
            label="Completed modules"
            hint={hasModules ? 'Ignored — this course has a lesson breakdown.' : 'Used to compute progress.'}
          >
            <Input
              type="number"
              min={0}
              disabled={hasModules}
              value={completedModules}
              onChange={(event) => setCompletedModules(Math.max(0, Number(event.target.value)))}
            />
          </Field>
        </FormGrid>

        <Field label="Notes">
          <Textarea
            value={notes}
            placeholder="Where you left off, what is confusing, exam target…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
