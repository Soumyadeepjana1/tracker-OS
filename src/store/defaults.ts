import type { Settings, ThemeMode } from '@/types';
import { addDays, todayISO } from '@/lib/date';

export const SETTINGS_STORAGE_KEY = 'devops-os:settings';
export const THEME_STORAGE_KEY = 'devops-os:theme';
export const CHAT_STORAGE_KEY = 'devops-os:chat';
export const TIMER_STORAGE_KEY = 'devops-os:timer';

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  githubUsername: '',
  dailyStudyTargetMinutes: 240,
  weeklyStudyTargetMinutes: 1_500,
  targetJobDate: addDays(todayISO(), 150),
  devopsDailyMinutes: 180,
  javaDailyMinutes: 60,
  preferredStudyTime: 'evening',
  theme: 'dark',
  accent: 'violet',
  weekStartsOn: 1,
  ai: {
    provider: 'none',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1',
    apiKey: '',
    temperature: 0.4,
    maxTokens: 700,
  },
  seededFromSample: false,
};

export const AI_PROVIDER_PRESETS = [
  {
    value: 'ollama' as const,
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1',
    hint: 'Runs fully on your machine. Start it with `ollama serve`.',
  },
  {
    value: 'openai-compatible' as const,
    label: 'OpenAI-compatible API',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: 'Works with OpenAI, Groq, OpenRouter, LM Studio, vLLM, llama.cpp server…',
  },
];

/** Reads and repairs persisted settings, tolerating missing/legacy fields. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch (error) {
    console.warn('[devops-os] Could not read settings, using defaults.', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
  } catch (error) {
    console.warn('[devops-os] Could not persist settings.', error);
  }
}

export function mergeSettings(base: Settings, patch: Partial<Settings> | undefined): Settings {
  if (!patch || typeof patch !== 'object') return { ...base };
  return {
    ...base,
    ...patch,
    ai: { ...base.ai, ...(patch.ai ?? {}) },
    dailyStudyTargetMinutes: positiveOr(patch.dailyStudyTargetMinutes, base.dailyStudyTargetMinutes),
    weeklyStudyTargetMinutes: positiveOr(patch.weeklyStudyTargetMinutes, base.weeklyStudyTargetMinutes),
    devopsDailyMinutes: positiveOr(patch.devopsDailyMinutes, base.devopsDailyMinutes),
    javaDailyMinutes: positiveOr(patch.javaDailyMinutes, base.javaDailyMinutes),
    theme: isTheme(patch.theme) ? patch.theme : base.theme,
  };
}

function positiveOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isTheme(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function resolveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return theme;
}

export function applyTheme(theme: ThemeMode): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}
