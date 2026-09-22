import type { ReactNode } from 'react';

/**
 * Inline SVG icon set — no icon dependency, no network request, and the whole
 * set tree-shakes to only the icons actually referenced.
 */

export interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

function make(path: ReactNode) {
  return function Icon({ className, size = 18, strokeWidth = 1.75 }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    );
  };
}

export const IconDashboard = make(
  <>
    <rect x="3" y="3" width="7.5" height="9" rx="1.8" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.8" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.8" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.8" />
  </>,
);
export const IconCalendar = make(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M8 3v3M16 3v3M3 9.5h18" />
  </>,
);
export const IconBook = make(
  <>
    <path d="M4 19.2A2.6 2.6 0 0 1 6.6 16.6H20" />
    <path d="M6.6 2.5H20v19H6.6A2.6 2.6 0 0 1 4 18.9V5.1a2.6 2.6 0 0 1 2.6-2.6z" />
  </>,
);
export const IconLayers = make(
  <>
    <path d="m12 2.5 9 4.8-9 4.8-9-4.8z" />
    <path d="m3 12.1 9 4.8 9-4.8" />
    <path d="m3 16.7 9 4.8 9-4.8" />
  </>,
);
export const IconFolder = make(
  <path d="M3 7.4A2.4 2.4 0 0 1 5.4 5h3.1a2 2 0 0 1 1.6.8l1 1.4h7.5A2.4 2.4 0 0 1 21 9.6v7.8a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 17.4z" />,
);
export const IconGithub = make(
  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
);
export const IconNote = make(
  <>
    <path d="M14 2.5H7A2 2 0 0 0 5 4.5v15A2 2 0 0 0 7 21.5h10a2 2 0 0 0 2-2V7.5z" />
    <path d="M14 2.5v5h5" />
    <path d="M9 13h6M9 17h4" />
  </>,
);
export const IconRefresh = make(
  <>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3.5v5h-5" />
  </>,
);
export const IconChart = make(
  <>
    <path d="M3 21h18" />
    <rect x="5" y="11" width="3.6" height="7" rx="1.2" />
    <rect x="10.2" y="5.5" width="3.6" height="12.5" rx="1.2" />
    <rect x="15.4" y="14" width="3.6" height="4" rx="1.2" />
  </>,
);
export const IconSparkles = make(
  <>
    <path d="M12 3l1.7 4.5L18 9.2l-4.3 1.7L12 15.4l-1.7-4.5L6 9.2l4.3-1.7z" />
    <path d="M18.6 15.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" />
    <path d="M5.2 13.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6L3 15.8l1.6-.6z" />
  </>,
);
export const IconSettings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.7-1.2l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.8a1.9 1.9 0 1 1 0-3.8h.2A1.6 1.6 0 0 0 5.2 7.6l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 .9-1.4V3.6a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.4 1z" />
  </>,
);
export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4-4" />
  </>,
);
export const IconBell = make(
  <>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </>,
);
export const IconSun = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const IconMoon = make(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconTrash = make(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="M18.5 6l-1 13.2A2 2 0 0 1 15.5 21h-7a2 2 0 0 1-2-1.8L5.5 6" />
    <path d="M10 11v6M14 11v6" />
  </>,
);
export const IconPencil = make(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z" />
  </>,
);
export const IconCheck = make(<path d="m20 6.5-11 11-5-5" />);
export const IconClose = make(<path d="M18 6 6 18M6 6l12 12" />);
export const IconChevronDown = make(<path d="m6 9.5 6 6 6-6" />);
export const IconChevronRight = make(<path d="m9 6 6 6-6 6" />);
export const IconPlay = make(<path d="m7 4 13 8-13 8z" />);
export const IconPause = make(<path d="M10 4H7v16h3zM17 4h-3v16h3z" />);
export const IconStop = make(<rect x="6" y="6" width="12" height="12" rx="2.5" />);
export const IconTimer = make(
  <>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 10v3.5l2.5 2" />
    <path d="M9.5 2.5h5" />
  </>,
);
export const IconFlame = make(
  <path d="M12 22c3.9 0 6.5-2.6 6.5-6.2 0-4.6-3.6-6.4-5-11.8-2.2 2-5.5 4.6-5.5 8.7 0 1.4.5 2.6 1.3 3.5-.2-1.4.3-2.7 1.3-3.7-.4 2.6.6 4 1.6 5.2.9 1 .8 2.2.3 3.3z" />,
);
export const IconExternalLink = make(
  <>
    <path d="M15 3h6v6" />
    <path d="M10.5 13.5 21 3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </>,
);
export const IconPin = make(
  <>
    <path d="M12 17v5" />
    <path d="M9 10.8V4.2A1.2 1.2 0 0 1 10.2 3h3.6A1.2 1.2 0 0 1 15 4.2v6.6l2 2.2v2H7v-2z" />
  </>,
);
export const IconArchive = make(
  <>
    <rect x="3" y="3.5" width="18" height="4.5" rx="1.6" />
    <path d="M5 8v10a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8" />
    <path d="M10 13h4" />
  </>,
);
export const IconDownload = make(
  <>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 21h14" />
  </>,
);
export const IconUpload = make(
  <>
    <path d="M12 21V9" />
    <path d="m7 13 5-5 5 5" />
    <path d="M5 3h14" />
  </>,
);
export const IconMenu = make(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconTarget = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.8" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </>,
);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.3l3.4 2" />
  </>,
);
export const IconAlert = make(
  <>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4.5M12 17.2h.01" />
  </>,
);
export const IconFilter = make(<path d="M3 5h18l-7 8v6l-4-2v-4z" />);
export const IconCopy = make(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2.4" />
    <path d="M5.5 15H4.4A1.4 1.4 0 0 1 3 13.6V4.4A1.4 1.4 0 0 1 4.4 3h9.2A1.4 1.4 0 0 1 15 4.4V5.5" />
  </>,
);
export const IconSend = make(
  <>
    <path d="M21.5 2.5 11 13" />
    <path d="M21.5 2.5 15 21.5l-4-8.5-8.5-4z" />
  </>,
);
export const IconReset = make(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </>,
);
export const IconDatabase = make(
  <>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5V18c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </>,
);
export const IconBulb = make(
  <>
    <path d="M9.5 18h5" />
    <path d="M10.5 21.5h3" />
    <path d="M12 2.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 2.5z" />
  </>,
);
export const IconList = make(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />);
export const IconStar = make(
  <path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.2L12 17.2 6.5 20.1l1-6.2L3 9.5l6.3-.9z" />,
);
export const IconFork = make(
  <>
    <circle cx="6" cy="5.5" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="M6 8v8.5" />
    <path d="M9 5.5h5.5a3.5 3.5 0 0 1 3.5 3.5v7" />
  </>,
);
export const IconTrendingUp = make(
  <>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M21 7.5V12h-4.5" />
  </>,
);
export const IconTerminal = make(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m7.5 10 2.5 2-2.5 2" />
    <path d="M13 14h3.5" />
  </>,
);
export const IconEye = make(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconZap = make(<path d="M13.5 2 4 14h7l-.5 8L20 10h-7z" />);
export const IconCheckCircle = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.2 12.2 2.6 2.6 5-5.8" />
  </>,
);
export const IconCircle = make(<circle cx="12" cy="12" r="8.5" />);
export const IconUser = make(
  <>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </>,
);
export const IconBookOpen = make(
  <>
    <path d="M12 6.5C10.5 5 8.5 4.5 3.5 4.5v13c5 0 7 .5 8.5 2 1.5-1.5 3.5-2 8.5-2v-13c-5 0-7 .5-8.5 2z" />
    <path d="M12 6.5v13" />
  </>,
);
export const IconBrain = make(
  <>
    <path d="M9.5 3.5A3 3 0 0 0 6.5 6.5 3 3 0 0 0 4 9.5 3 3 0 0 0 5.5 12 3 3 0 0 0 4 14.5a3 3 0 0 0 2.5 3 3 3 0 0 0 3 3 1.5 1.5 0 0 0 1.5-1.5v-14a1.5 1.5 0 0 0-1.5-1.5z" />
    <path d="M14.5 3.5a3 3 0 0 1 3 3 3 3 0 0 1 2.5 3 3 3 0 0 1-1.5 2.5 3 3 0 0 1 1.5 2.5 3 3 0 0 1-2.5 3 3 3 0 0 1-3 3A1.5 1.5 0 0 1 13 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
  </>,
);
