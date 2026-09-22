import type { IconProps } from '@/components/icons';
import {
  IconBook,
  IconCalendar,
  IconChart,
  IconDashboard,
  IconFolder,
  IconGithub,
  IconLayers,
  IconNote,
  IconRefresh,
  IconSettings,
  IconSparkles,
  IconTimer,
} from '@/components/icons';
import type { ComponentType } from 'react';
import type { AppState } from '@/store/store';
import { needsRevision } from '@/lib/progress';
import { todayISO } from '@/lib/date';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  badge?: (state: AppState) => number | undefined;
  hint?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: IconDashboard },
      {
        to: '/planner',
        label: 'Study Planner',
        icon: IconCalendar,
        badge: (state) =>
          state.tasks.filter((task) => task.date === todayISO() && task.status !== 'completed').length || undefined,
        hint: 'Pending tasks today',
      },
      { to: '/timer', label: 'Study Timer', icon: IconTimer },
    ],
  },
  {
    label: 'Learning',
    items: [
      { to: '/courses', label: 'Courses', icon: IconBook },
      { to: '/topics', label: 'Topics', icon: IconLayers },
      {
        to: '/projects',
        label: 'Projects',
        icon: IconFolder,
        badge: (state) => state.projects.filter((project) => project.status === 'in-progress').length || undefined,
      },
      { to: '/notes', label: 'Notes', icon: IconNote },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        to: '/revision',
        label: 'Revision',
        icon: IconRefresh,
        badge: (state) => {
          const today = todayISO();
          return state.topics.filter((topic) => needsRevision(topic, today)).length || undefined;
        },
        hint: 'Topics needing revision',
      },
      { to: '/analytics', label: 'Analytics', icon: IconChart },
      { to: '/github', label: 'GitHub', icon: IconGithub },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/assistant', label: 'AI Assistant', icon: IconSparkles },
      { to: '/settings', label: 'Settings', icon: IconSettings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
