import type { AISettings } from '@/types';

/**
 * Optional AI providers.
 *
 * The app ships with **no** provider configured and no hard-coded keys. A user
 * may point it at Ollama (fully local) or any OpenAI-compatible endpoint. Every
 * failure is returned as data, never thrown, so the rest of the app is never
 * affected by an unreachable model.
 */

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ProviderResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; hint?: string };

const DEFAULT_TIMEOUT = 60_000;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function friendlyNetworkError(error: unknown, baseUrl: string): { error: string; hint?: string } {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      error: 'The AI request timed out.',
      hint: 'Local models can be slow on first load — try again, or pick a smaller model.',
    };
  }
  if (error instanceof TypeError) {
    return {
      error: `Could not reach ${baseUrl}.`,
      hint:
        'Check that the server is running and that it allows browser requests (CORS). For Ollama: `OLLAMA_ORIGINS=* ollama serve`.',
    };
  }
  return { error: error instanceof Error ? error.message : 'Unknown AI provider error' };
}

export async function callAI(
  settings: AISettings,
  turns: ChatTurn[],
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  if (!baseUrl) {
    return { ok: false, error: 'No provider URL configured.', hint: 'Set it on the AI Assistant page.' };
  }
  if (!settings.model.trim()) {
    return { ok: false, error: 'No model name configured.', hint: 'e.g. llama3.1 for Ollama, gpt-4o-mini for OpenAI.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  try {
    if (settings.provider === 'ollama') {
      return await callOllama(settings, turns, controller.signal, baseUrl);
    }
    if (settings.provider === 'openai-compatible') {
      return await callOpenAICompatible(settings, turns, controller.signal, baseUrl);
    }
    return {
      ok: false,
      error: 'No AI provider selected.',
      hint: 'The assistant falls back to its offline planner until you configure one.',
    };
  } catch (error) {
    return { ok: false, ...friendlyNetworkError(error, baseUrl) };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

async function callOllama(
  settings: AISettings,
  turns: ChatTurn[],
  signal: AbortSignal,
  baseUrl: string,
): Promise<ProviderResult> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      messages: turns,
      stream: false,
      options: { temperature: settings.temperature, num_predict: settings.maxTokens },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return {
      ok: false,
      error: `Ollama returned ${response.status}.`,
      hint: body.includes('not found')
        ? `Model "${settings.model}" is not installed. Run \`ollama pull ${settings.model}\`.`
        : body.slice(0, 200) || 'Check the Ollama logs.',
    };
  }

  const data = (await response.json()) as { message?: { content?: string }; response?: string };
  const text = data.message?.content ?? data.response ?? '';
  if (!text.trim()) return { ok: false, error: 'Ollama returned an empty response.' };
  return { ok: true, text, model: settings.model };
}

async function callOpenAICompatible(
  settings: AISettings,
  turns: ChatTurn[],
  signal: AbortSignal,
  baseUrl: string,
): Promise<ProviderResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: settings.model,
      messages: turns,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = body.slice(0, 240);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      detail = parsed.error?.message ?? detail;
    } catch {
      /* keep raw body */
    }
    return {
      ok: false,
      error: `Provider returned ${response.status}`,
      hint: response.status === 401 ? 'Check your API key.' : detail || undefined,
    };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) return { ok: false, error: 'Provider returned an empty response.' };
  return { ok: true, text, model: settings.model };
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  hint?: string;
}

/** Lightweight connectivity probe used by the AI settings panel. */
export async function testConnection(settings: AISettings): Promise<ConnectionTestResult> {
  if (settings.provider === 'none') {
    return { ok: false, message: 'No provider selected — the offline planner will be used instead.' };
  }

  const result = await callAI(
    { ...settings, maxTokens: 32 },
    [
      { role: 'system', content: 'Reply with exactly: OK' },
      { role: 'user', content: 'ping' },
    ],
    AbortSignal.timeout?.(20_000),
  );

  if (!result.ok) return { ok: false, message: result.error, hint: result.hint };
  return {
    ok: true,
    message: `Connected to ${result.model}. Response: ${result.text.trim().slice(0, 60)}`,
  };
}

/** Lists models exposed by an Ollama server, for the model picker. */
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tags`, {
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8_000) : undefined,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((model) => model.name).sort();
  } catch {
    return [];
  }
}
