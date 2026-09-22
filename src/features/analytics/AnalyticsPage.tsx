import { useMemo, useState } from 'react';
import { store, useApp } from '@/store/store';
import { computeAnalytics } from '@/lib/analytics';
import { addDays, formatDate, fromISODate, lastNDays, monthLabel, startOfMonth, todayISO, toISODate } from '@/lib/date';
import { cn, formatHours, formatMinutes, percent, round1, sum } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionCard,
  Segmented,
  StatCard,
} from '@/components/ui/primitives';
import { ActivityHeatmap, BarChart, DonutChart } from '@/components/charts';
import {
  IconChart,
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconFlame,
  IconTrendingUp,
} from '@/components/icons';
import { downloadFile } from '@/lib/utils';
import { progressToMarkdown } from '@/lib/backup';

type Range = '7' | '14' | '30' | '90';

export function AnalyticsPage() {
  const state = useApp();
  const analytics = useMemo(() => computeAnalytics(state), [state]);
  const [range, setRange] = useState<Range>('14');
  const days = Number(range);

  const series = useMemo(() => {
    const window = lastNDays(days, todayISO());
    return window.map((date) => ({
      label: `${fromISODate(date).getDate()}`,
      value: round1((analytics.studyMinutesByDay[date] ?? 0) / 60),
      date,
    }));
  }, [analytics.studyMinutesByDay, days]);

  const weekdayAverages = useMemo(() => {
    const totals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    for (const [date, minutes] of Object.entries(analytics.studyMinutesByDay)) {
      const day = fromISODate(date).getDay();
      totals[day].sum += minutes;
      totals[day].count += 1;
    }
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels.map((label, index) => ({
      label,
      value: round1(totals[index].count ? totals[index].sum / totals[index].count / 60 : 0),
    }));
  }, [analytics.studyMinutesByDay]);

  const monthlySeries = useMemo(() => {
    const monthStart = startOfMonth(todayISO());
    return Array.from({ length: 6 }, (_, index) => {
      const reference = fromISODate(addDays(monthStart, -30 * (5 - index)));
      const start = toISODate(new Date(reference.getFullYear(), reference.getMonth(), 1));
      const end = toISODate(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
      const minutes = sum(
        Object.entries(analytics.studyMinutesByDay)
          .filter(([date]) => date >= start && date <= end)
          .map(([, value]) => value),
      );
      return { label: monthLabel(start), value: round1(minutes / 60) };
    });
  }, [analytics.studyMinutesByDay]);

  const rangeMinutes = sum(series.map((entry) => entry.value * 60));
  const activeInRange = series.filter((entry) => entry.value > 0).length;
  const bestDay = [...series].sort((a, b) => b.value - a.value)[0];
  const taskBreakdown = [
    { label: 'Completed', value: analytics.overallTaskStats.completed },
    { label: 'Pending', value: analytics.overallTaskStats.pending },
    { label: 'In progress', value: analytics.overallTaskStats.inProgress },
    { label: 'Skipped', value: analytics.overallTaskStats.skipped },
  ].filter((entry) => entry.value > 0);

  const courseCompletion = [...analytics.courseSummaries].sort((a, b) => b.progress - a.progress);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Where your time actually goes, how consistent you are, and which parts of the plan are slipping."
        actions={
          <>
            <Segmented
              options={[
                { value: '7', label: '7d' },
                { value: '14', label: '14d' },
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
              ]}
              value={range}
              onChange={setRange}
              size="sm"
            />
            <Button
              variant="secondary"
              icon={<IconDownload size={15} />}
              onClick={() => {
                downloadFile('devops-progress.md', progressToMarkdown(state), 'text/markdown');
                store.toast({ title: 'Progress report exported', message: 'devops-progress.md saved.', tone: 'ok' });
              }}
            >
              Export report
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Studied (${days}d)`}
          value={formatHours(rangeMinutes)}
          hint={`${activeInRange} of ${days} days active · average ${formatMinutes(rangeMinutes / days)} per day`}
          icon={<IconClock size={16} />}
          tone="brand"
        />
        <StatCard
          label="Consistency"
          value={`${analytics.consistency}%`}
          hint="Active days over the last 28 days"
          icon={<IconTrendingUp size={16} />}
          tone={analytics.consistency >= 70 ? 'ok' : analytics.consistency >= 40 ? 'warn' : 'danger'}
          footer={<ProgressBar value={analytics.consistency} />}
        />
        <StatCard
          label="Streak"
          value={`${analytics.streak.current}d`}
          hint={`Longest ${analytics.streak.longest} days · ${analytics.activeDays.length} total active days`}
          icon={<IconFlame size={16} />}
          tone="warn"
        />
        <StatCard
          label="Best day"
          value={bestDay && bestDay.value ? `${bestDay.value}h` : '—'}
          hint={bestDay ? formatDate(bestDay.date, 'medium') : 'No data in this range'}
          icon={<IconChart size={16} />}
          tone="accent"
        />
      </div>

      <SectionCard
        icon={<IconChart size={15} />}
        title={`Daily study hours — last ${days} days`}
        subtitle={`Target ${formatHours(analytics.targetToday * days)} for this window · logged ${formatHours(rangeMinutes)}`}
        bodyClassName="px-5 py-4"
      >
        <BarChart data={series} unit="h" height={200} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={<IconTrendingUp size={15} />}
          title="Monthly hours"
          subtitle="Last six months"
          bodyClassName="px-5 py-4"
        >
          <BarChart data={monthlySeries} unit="h" height={160} tone="accent" />
        </SectionCard>
        <SectionCard
          icon={<IconClock size={15} />}
          title="Average hours by weekday"
          subtitle="Find the days you consistently lose"
          bodyClassName="px-5 py-4"
        >
          <BarChart data={weekdayAverages} unit="h" height={160} tone="warn" />
        </SectionCard>
      </div>

      <SectionCard
        icon={<IconFlame size={15} />}
        title="Study activity calendar"
        subtitle={`${analytics.activeDays.length} active days recorded`}
        bodyClassName="px-5 py-4"
      >
        <ActivityHeatmap cells={analytics.heatmap} />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard icon={<IconCheckCircle size={15} />} title="Tasks" subtitle="Lifecycle of every planned task" bodyClassName="px-5 py-4">
          {taskBreakdown.length ? (
            <DonutChart
              segments={taskBreakdown}
              size={150}
              thickness={16}
              centerLabel="tasks"
              centerValue={`${analytics.overallTaskStats.total}`}
            />
          ) : (
            <EmptyState title="No tasks yet" description="Plan tasks in the Study Planner to see this breakdown." />
          )}
        </SectionCard>

        <SectionCard icon={<IconClock size={15} />} title="Study time by subject" subtitle="All-time split" bodyClassName="px-5 py-4">
          {analytics.subjectMinutesSeries.length ? (
            <DonutChart
              segments={analytics.subjectMinutesSeries.map((entry) => ({ label: entry.label, value: entry.value }))}
              size={150}
              thickness={16}
              centerLabel="hours"
              centerValue={`${Math.round(analytics.minutesTotal / 60)}`}
            />
          ) : (
            <EmptyState title="No sessions logged" description="Use the study timer or log time manually." />
          )}
        </SectionCard>

        <SectionCard icon={<IconTrendingUp size={15} />} title="Overall completion" subtitle="Weighted blend of topics, courses and projects" bodyClassName="px-5 py-4">
          <ul className="flex flex-col gap-4">
            {[
              { label: 'Topics', value: analytics.topicStats.total ? Math.round(sum(state.topics.map((topic) => topic.progress)) / state.topics.length) : 0, hint: `${analytics.topicStats.completed}/${analytics.topicStats.total} completed` },
              { label: 'Courses', value: analytics.courseProgressAverage, hint: `${analytics.courseSummaries.length} courses` },
              { label: 'Projects', value: analytics.projectProgressAverage, hint: `${analytics.projectSummaries.length} projects` },
            ].map((entry) => (
              <li key={entry.label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-fg">{entry.label}</span>
                  <span className="font-mono text-fg-muted">{entry.value}%</span>
                </div>
                <ProgressBar value={entry.value} className="mt-1.5" height={6} />
                <span className="mt-1 block text-[10.5px] text-fg-subtle">{entry.hint}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={<IconChart size={15} />} title="Course completion" subtitle="Ranked by progress" bodyClassName="px-5 py-4">
          {courseCompletion.length ? (
            <ul className="flex flex-col gap-3.5">
              {courseCompletion.map((entry) => (
                <li key={entry.course.id}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-fg">{entry.course.name}</span>
                    <Badge tone={entry.progress >= 100 ? 'ok' : 'brand'}>{entry.progress}%</Badge>
                  </div>
                  <ProgressBar value={entry.progress} className="mt-1.5" height={6} />
                  <span className="mt-1 block text-[10.5px] text-fg-subtle">
                    {entry.completedModules}/{entry.totalModules} modules · {entry.remainingModules} remaining
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No courses tracked" description="Add courses to track completion here." />
          )}
        </SectionCard>

        <SectionCard icon={<IconChart size={15} />} title="Topic completion by category" subtitle="Mastery and revision debt" bodyClassName="px-5 py-4">
          {analytics.categoryProgress.length ? (
            <ul className="flex flex-col gap-3">
              {analytics.categoryProgress.slice(0, 10).map((entry) => (
                <li key={entry.subject} className="flex items-center gap-3">
                  <span className="min-w-28 flex-1 truncate text-[12.5px] text-fg">{entry.subject}</span>
                  <span className="w-28 shrink-0">
                    <ProgressBar value={entry.progress} height={5} />
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-[11px] text-fg-muted">
                    {entry.completed}/{entry.total} · {entry.progress}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No topics tracked" description="Add topics to see category mastery." />
          )}
        </SectionCard>
      </div>

      <SectionCard icon={<IconTrendingUp size={15} />} title="Weekly and monthly summary" subtitle="Rolling totals" bodyClassName="px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Today', value: formatMinutes(analytics.minutesToday), hint: `${analytics.todayProgress}% of target` },
            { label: 'This week', value: formatMinutes(analytics.minutesThisWeek), hint: `${analytics.weekProgress}% of ${formatMinutes(analytics.weekTarget)}` },
            { label: 'This month', value: formatMinutes(analytics.minutesThisMonth), hint: `${analytics.monthProgress}% of ${formatMinutes(analytics.monthTarget)}` },
            { label: 'All time', value: formatHours(analytics.minutesTotal), hint: `${state.sessions.length} sessions logged` },
          ].map((entry) => (
            <div key={entry.label} className={cn('rounded-xl border border-line bg-surface-2 p-3.5')}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">{entry.label}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-fg">{entry.value}</p>
              <p className="mt-0.5 text-[11px] text-fg-subtle">{entry.hint}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-fg-muted">
          Task completion rate: <strong className="text-fg">{percent(analytics.overallTaskStats.completed, Math.max(1, analytics.overallTaskStats.total))}%</strong> ·
          topics completed: <strong className="text-fg">{analytics.topicStats.completed}</strong> ·
          revision debt: <strong className="text-fg">{analytics.revisionTopics.length}</strong>
        </span>
        <span className="ml-auto text-[11px] text-fg-subtle">
          Analytics are computed client-side from IndexedDB — nothing leaves your browser.
        </span>
      </Card>
    </PageBody>
  );
}
