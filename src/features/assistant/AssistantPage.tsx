import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useApp } from '@/store/store';
import { executeConfirmedTool, greetingMessage, runAssistant } from '@/ai/assistant';
import { TOOLS } from '@/ai/tools';
import { computeAnalytics } from '@/lib/analytics';
import { AI_PROVIDER_PRESETS, CHAT_STORAGE_KEY } from '@/store/defaults';
import { renderMarkdown } from '@/lib/markdown';
import { cn, formatMinutes, uid } from '@/lib/utils';
import { relativeTime } from '@/lib/date';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, IconButton, SectionCard, TONE_CLASSES } from '@/components/ui/primitives';
import { Textarea } from '@/components/ui/form';
import type { ChatMessage, PendingToolCall } from '@/types';
import {
  IconAlert,
  IconBrain,
  IconBulb,
  IconCheck,
  IconClose,
  IconCopy,
  IconRefresh,
  IconSend,
  IconSettings,
  IconSparkles,
  IconStop,
  IconTerminal,
  IconTrash,
} from '@/components/icons';

const QUICK_PROMPTS = [
  'আমার আজকে কী পড়া উচিত?',
  'Analyse my progress and tell me what is slipping.',
  'Build a 3-day plan around my revision queue.',
  'Generate revision questions for my weakest topics.',
  'Summarise what I have done this week.',
  'Suggest improvements to my Kubernetes project.',
];

export function AssistantPage() {
  const state = useApp();
  const navigate = useNavigate();
  const analytics = useMemo(() => computeAnalytics(state), [state]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  const provider = state.settings.ai.provider;
  const preset = AI_PROVIDER_PRESETS.find((entry) => entry.value === provider);

  // Restore the transcript, then keep it in sync with localStorage.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) store.setChat(parsed.slice(-40));
      }
    } catch {
      /* ignore malformed transcript */
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.chat.slice(-40)));
    } catch {
      /* storage full or unavailable */
    }
  }, [state.chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.chat.length, busy]);

  const send = async (message: string) => {
    const text = message.trim();
    if (!text || busy) return;

    setDraft('');
    setError(null);
    store.appendChat({ id: uid('msg'), role: 'user', content: text, createdAt: new Date().toISOString() });

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    try {
      const result = await runAssistant({
        message: text,
        state: store.getState(),
        analytics: computeAnalytics(store.getState()),
        history: store.getState().chat,
        signal: controller.signal,
      });

      store.appendChat({
        id: uid('msg'),
        role: 'assistant',
        content: result.text,
        createdAt: new Date().toISOString(),
        pending: result.pending,
        toolResults: result.toolResults,
        local: result.local,
        error: false,
      });

      if (result.providerError) setError(result.providerError);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        store.appendChat({
          id: uid('msg'),
          role: 'assistant',
          content: '_Request cancelled._',
          createdAt: new Date().toISOString(),
        });
      } else {
        setError(caught instanceof Error ? caught.message : 'The assistant failed unexpectedly.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const resolvePending = (messageId: string, call: PendingToolCall) => {
    const remaining =
      store.getState().chat.find((entry) => entry.id === messageId)?.pending?.filter((entry) => entry.id !== call.id) ?? [];
    store.patchChat(messageId, { pending: remaining });
  };

  const appendToolNote = (content: string) => {
    store.appendChat({ id: uid('msg'), role: 'tool', content, createdAt: new Date().toISOString() });
  };

  /**
   * Writes and destructive tools never run on their own: the user must approve
   * them in the confirmation dialog, which is the only path to execution.
   */
  const confirmTool = (messageId: string, call: PendingToolCall) => {
    store.requestConfirmation({
      title: call.destructive ? 'Confirm destructive action' : 'Confirm action',
      message: `${call.summary}\n\nThis changes your stored data.`,
      detail: JSON.stringify(call.args, null, 2),
      confirmLabel: call.destructive ? 'Confirm delete' : 'Confirm',
      tone: call.destructive ? 'danger' : 'brand',
      onConfirm: async () => {
        const outcome = await executeConfirmedTool(call);
        resolvePending(messageId, call);
        appendToolNote(outcome.ok ? `✅ ${outcome.message}` : `⚠️ ${outcome.message}`);
        store.toast({
          title: outcome.ok ? 'Action applied' : 'Action failed',
          message: outcome.message,
          tone: outcome.ok ? 'ok' : 'danger',
        });
      },
    });
  };

  const cancelTool = (messageId: string, call: PendingToolCall) => {
    resolvePending(messageId, call);
    appendToolNote(`Cancelled: ${call.summary}`);
  };

  const messages = state.chat.length
    ? state.chat
    : [
        {
          id: 'greeting',
          role: 'assistant' as const,
          content: greetingMessage(analytics, state.settings.name),
          createdAt: new Date().toISOString(),
          local: true,
        },
      ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Optional AI"
        title="AI Assistant"
        description="Ask about your progress, get a study plan, generate notes or revision questions. It only sees the summary you allow — and every change it proposes needs your confirmation."
        actions={
          <>
            <Button variant="secondary" icon={<IconSettings size={15} />} onClick={() => navigate('/settings?tab=ai')}>
              AI settings
            </Button>
            <Button
              variant="ghost"
              icon={<IconTrash size={15} />}
              onClick={() => {
                store.clearChat();
                try {
                  localStorage.removeItem(CHAT_STORAGE_KEY);
                } catch {
                  /* ignore */
                }
                store.toast({ title: 'Conversation cleared', tone: 'info' });
              }}
            >
              Clear chat
            </Button>
          </>
        }
      />

      {provider === 'none' ? (
        <Card className="border-brand/30 bg-brand-soft">
          <div className="flex flex-wrap items-start gap-3">
            <IconSparkles size={18} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-fg">Running in offline mode</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">
                No AI provider is configured, so the assistant uses a deterministic planner built into the app. It reads
                your tasks, courses, topics and revision queue and produces a study plan — no network access, no key.
                Configure Ollama or any OpenAI-compatible endpoint for free-form answers.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/settings?tab=ai')}>
              Configure a provider
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-warn/40 bg-warn-soft">
          <div className="flex items-start gap-2.5">
            <IconAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-fg">The model could not be reached</p>
              <p className="mt-0.5 text-[12px] text-fg-muted">{error}</p>
              <p className="mt-1 text-[11.5px] text-fg-subtle">
                The offline planner answered instead. Everything else in the app keeps working.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padded={false} className="flex h-[68vh] min-h-[520px] flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-white">
                <IconBrain size={16} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-fg">Learning assistant</p>
                <p className="text-[11px] text-fg-subtle">
                  {provider === 'none' ? 'Offline planner' : `${preset?.label ?? provider} · ${state.settings.ai.model}`}
                </p>
              </div>
            </div>
            <Badge tone={provider === 'none' ? 'neutral' : 'ok'} dot>
              {provider === 'none' ? 'offline' : 'connected'}
            </Badge>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                onConfirm={(call) => confirmTool(message.id, call)}
                onCancel={(call) => cancelTool(message.id, call)}
              />
            ))}

            {busy ? (
              <div className="flex items-center gap-2.5 text-[12.5px] text-fg-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-3">
                  <IconSparkles size={15} className="animate-pulse" />
                </span>
                <span className="flex items-center gap-1">
                  Thinking
                  <span className="animate-pulse">…</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<IconStop size={13} />}
                  className="ml-auto"
                  onClick={() => abortRef.current?.abort()}
                >
                  Stop
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-line bg-surface-2 px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                rows={1}
                placeholder="Ask about your progress, or type “আমার আজকে কী পড়া উচিত?”…"
                className="min-h-10 max-h-32 flex-1 resize-none py-2.5"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <Button
                variant="primary"
                icon={<IconSend size={15} />}
                disabled={!draft.trim() || busy}
                onClick={() => void send(draft)}
              >
                Send
              </Button>
            </div>
            <p className="mt-1.5 text-[10.5px] text-fg-subtle">
              Enter to send · Shift+Enter for a new line · the assistant can only use the tools listed on the right.
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <SectionCard icon={<IconTerminal size={15} />} title="Tool access" subtitle="What the assistant is allowed to do" bodyClassName="px-5 py-4">
            <ul className="flex flex-col gap-2">
              {TOOLS.map((tool) => (
                <li key={tool.name} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                      TONE_CLASSES[tool.kind === 'read' ? 'ok' : tool.kind === 'write' ? 'info' : 'danger'].soft,
                    )}
                  >
                    {tool.kind === 'read' ? <IconCheck size={11} strokeWidth={3} /> : <IconAlert size={11} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[11.5px] font-medium text-fg">{tool.name}()</span>
                    <span className="block text-[10.5px] text-fg-subtle">
                      {tool.kind === 'read'
                        ? 'Runs automatically'
                        : tool.kind === 'write'
                          ? 'Needs your confirmation'
                          : 'Destructive — always confirmed'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg border border-line bg-surface-2 p-2.5 text-[11px] text-fg-subtle">
              There is no shell, filesystem, network or code-execution tool. The model can only request the functions
              above, and you approve each change.
            </p>
          </SectionCard>

          <SectionCard icon={<IconBulb size={15} />} title="Try asking" subtitle="Grounded in your real data" bodyClassName="px-5 py-4">
            <ul className="flex flex-col gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => void send(prompt)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>

          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Snapshot sent</span>
              <IconButton
                label="Copy snapshot summary"
                size="sm"
                icon={<IconCopy size={13} />}
                onClick={() => {
                  const summary = [
                    `Overall ${analytics.overall}%`,
                    `Today ${formatMinutes(analytics.minutesToday)} / ${formatMinutes(analytics.targetToday)}`,
                    `Streak ${analytics.streak.current}d`,
                    `Pending tasks ${analytics.todayTaskStats.pending}`,
                    `Revision queue ${analytics.revisionTopics.length}`,
                    `Courses ${analytics.courseSummaries.length} · projects ${analytics.projectSummaries.length}`,
                  ].join('\n');
                  navigator.clipboard
                    ?.writeText(summary)
                    .then(() => store.toast({ title: 'Snapshot copied', tone: 'ok' }))
                    .catch(() => store.toast({ title: 'Clipboard unavailable', tone: 'warn' }));
                }}
              />
            </div>
            <ul className="flex flex-col gap-1 text-[11.5px] text-fg-muted">
              <li>Overall progress · {analytics.overall}%</li>
              <li>Today · {formatMinutes(analytics.minutesToday)} of {formatMinutes(analytics.targetToday)}</li>
              <li>Streak · {analytics.streak.current} days</li>
              <li>Revision queue · {analytics.revisionTopics.length} topics</li>
              <li>Courses · {analytics.courseSummaries.length} · Projects · {analytics.projectSummaries.length}</li>
              <li>Last refreshed · {relativeTime(new Date().toISOString())}</li>
            </ul>
            <p className="text-[10.5px] text-fg-subtle">
              Only this summary plus your question is sent to the configured provider — never your whole database.
            </p>
          </Card>

          <Card className="flex items-start gap-2.5">
            <IconRefresh size={14} className="mt-0.5 shrink-0 text-fg-subtle" />
            <p className="text-[11px] text-fg-subtle">
              The assistant is optional. If the provider is offline the app falls back to the local planner and nothing
              else breaks.
            </p>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

function ChatBubble({
  message,
  onConfirm,
  onCancel,
}: {
  message: ChatMessage;
  onConfirm: (call: PendingToolCall) => void;
  onCancel: (call: PendingToolCall) => void;
}) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const html = useMemo(() => renderMarkdown(message.content), [message.content]);

  if (isTool) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[12px] text-fg-muted">
        <IconTerminal size={13} className="shrink-0" />
        <span className="min-w-0 flex-1">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold',
          isUser ? 'bg-surface-3 text-fg-muted' : 'bg-gradient-to-br from-brand to-accent text-white',
        )}
      >
        {isUser ? 'You' : <IconSparkles size={15} />}
      </span>

      <div className={cn('min-w-0 flex-1', isUser && 'flex justify-end')}>
        <div
          className={cn(
            'rounded-2xl border px-4 py-3',
            isUser
              ? 'max-w-[85%] border-brand/30 bg-brand-soft text-fg'
              : 'border-line bg-surface-2 text-fg',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-[13px]">{message.content}</p>
          ) : (
            <div className="prose-note max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          )}

          {message.toolResults?.length ? (
            <details className="mt-3 rounded-lg border border-line bg-surface px-3 py-2">
              <summary className="cursor-pointer text-[11.5px] font-medium text-fg-muted">
                {message.toolResults.length} tool result(s)
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {message.toolResults.map((result, index) => (
                  <li key={index} className="font-mono text-[11px] text-fg-subtle">
                    <span className="font-semibold text-fg-muted">{result.name}</span>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{result.output}</pre>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {message.pending?.length ? (
            <div className="mt-3 flex flex-col gap-2">
              {message.pending.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    'rounded-xl border p-3',
                    call.destructive ? 'border-danger/40 bg-danger-soft' : 'border-brand/40 bg-brand-soft',
                  )}
                >
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-fg">
                    <IconAlert size={13} />
                    {call.destructive ? 'Destructive action requested' : 'Action requested'}
                  </p>
                  <p className="mt-1 text-[12px] text-fg-muted">{call.summary}</p>
                  <p className="mt-1 font-mono text-[10.5px] text-fg-subtle">{call.name}()</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button size="sm" variant={call.destructive ? 'danger' : 'primary'} onClick={() => onConfirm(call)}>
                      {call.destructive ? 'Confirm delete' : 'Confirm'}
                    </Button>
                    <Button size="sm" variant="ghost" icon={<IconClose size={12} />} onClick={() => onCancel(call)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            {message.local && !isUser ? <Badge tone="neutral">offline planner</Badge> : null}
            {message.error ? <Badge tone="danger">failed</Badge> : null}
            <span className="text-[10px] text-fg-subtle">{new Date(message.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
