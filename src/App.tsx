import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PlannerPage } from '@/features/planner/PlannerPage';
import { CoursesPage } from '@/features/courses/CoursesPage';
import { TopicsPage } from '@/features/topics/TopicsPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { GitHubPage } from '@/features/github/GitHubPage';
import { NotesPage } from '@/features/notes/NotesPage';
import { RevisionPage } from '@/features/revision/RevisionPage';
import { TimerPage } from '@/features/timer/TimerPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AssistantPage } from '@/features/assistant/AssistantPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SearchPage } from '@/features/search/SearchPage';
import { NotFoundPage } from '@/features/NotFoundPage';
import { useApp } from '@/store/store';
import { applyTheme } from '@/store/defaults';

/**
 * Hash routing is deliberate: GitHub Pages serves static files only, so
 * `/#/planner` never 404s on a refresh or a deep link, and the built bundle can
 * live at any sub-path.
 */
export default function App() {
  const { settings } = useApp();
  const { theme } = settings;

  // Keep the <html> class in sync with the chosen theme.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS when the user picked "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const listener = () => applyTheme('system');
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/github" element={<GitHubPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/revision" element={<RevisionPage />} />
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
