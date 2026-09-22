import type { ChatMessage, PendingToolCall } from '@/types';
import type { Analytics } from '@/lib/analytics';
import type { AppState } from '@/store/store';
import { store } from '@/store/store';
import { formatMinutes, truncate, uid } from '@/lib/utils';
import { computeAnalytics } from '@/lib/analytics';
import { buildContextSnapshot } from './context';
import { callAI, type ChatTurn } from './providers';
import {
  describeInvocation,
  getTool,
  parseToolInvocations,
  toolManifest,
  type ToolArgs,
} from './tools';

export interface AssistantResult {
  text: string;
  pending: PendingToolCall[];
  toolResults: { name: string; ok: boolean; output: string }[];
  local: boolean;
  providerError?: string;
}

const SYSTEM_PROMPT = `You are the assistant built into "DevOps Learning OS", a personal learning dashboard for a DevOps engineer.

You help with: analysing learning progress, planning study days, suggesting today's tasks, explaining weak areas, generating study notes, generating revision and interview questions, summarising progress, reviewing GitHub activity and improving projects.

STRICT OUTPUT CONTRACT — reply with ONE JSON object and nothing else:
{"reply": "<markdown answer for the user>", "toolCalls": [{"name": "<tool>", "args": {}}]}

Available tools:
${'${MANIFEST}'}

Rules:
1. Never invent data. Use the CONTEXT SNAPSHOT; if something is missing, say so.
2. Only call tools from the list above. No shell, filesystem, network or code execution exists.
3. Prefer read tools to gather detail. Propose write/destructive tools only when the user clearly asks for a change; the user will be asked to confirm each one.
4. Keep replies focused and scannable: markdown headings, short bullet lists, concrete numbers and time budgets.
5. Write in the same language as the user's message.`;

interface ModelEnvelope {
  reply?: string;
  toolCalls?: unknown;
  tool_calls?: unknown;
}

/** Extracts the first JSON object from a model response, tolerating prose/fences. */
export function extractJson(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to brace scanning */
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function toPending(invocations: { name: string; args: ToolArgs }[], state: AppState): PendingToolCall[] {
  return invocations
    .map((invocation) => {
      const tool = getTool(invocation.name);
      if (!tool || tool.kind === 'read') return null;
      return {
        id: uid('ptc'),
        name: invocation.name,
        args: invocation.args,
        summary: describeInvocation(invocation, state),
        destructive: tool.kind === 'destructive',
      } satisfies PendingToolCall;
    })
    .filter((entry): entry is PendingToolCall => entry !== null);
}

/** Executes a confirmed tool call, returning a human-readable outcome. */
export async function executeConfirmedTool(
  call: PendingToolCall,
): Promise<{ ok: boolean; message: string }> {
  const tool = getTool(call.name);
  if (!tool) return { ok: false, message: `Unknown tool "${call.name}".` };
  if (tool.kind === 'read') return { ok: false, message: 'Read tools do not need confirmation.' };

  const state = store.getState();
  try {
    const output = await tool.run(call.args, state, computeAnalytics(state));
    return { ok: true, message: output };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Tool failed.' };
  }
}

export interface RunAssistantInput {
  message: string;
  state: AppState;
  analytics: Analytics;
  history: ChatMessage[];
  signal?: AbortSignal;
}

export async function runAssistant(input: RunAssistantInput): Promise<AssistantResult> {
  const { state, analytics, message } = input;
  const provider = state.settings.ai.provider;

  if (provider === 'none') {
    return { ...planOffline(message, state, analytics), providerError: undefined };
  }

  const snapshot = buildContextSnapshot({
    analytics,
    courses: state.courses,
    topics: state.topics,
    tasks: state.tasks,
    projects: state.projects,
    notes: state.notes,
    learnerName: state.settings.name,
    githubUsername: state.github.username,
    githubRepos: state.github.repositories,
  });

  const turns: ChatTurn[] = [
    { role: 'system', content: SYSTEM_PROMPT.replace('${MANIFEST}', toolManifest()) },
    {
      role: 'system',
      content: `CONTEXT SNAPSHOT (JSON):\n${JSON.stringify(snapshot)}`,
    },
    ...input.history
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .slice(-6)
      .map<ChatTurn>((entry) => ({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: truncate(entry.content, 1_200),
      })),
    { role: 'user', content: message },
  ];

  const first = await callAI(state.settings.ai, turns, input.signal);
  if (!first.ok) {
    const fallback = planOffline(message, state, analytics);
    return { ...fallback, providerError: first.hint ? `${first.error} ${first.hint}` : first.error };
  }

  const envelope = extractJson(first.text) as ModelEnvelope | null;
  const invocations = parseToolInvocations(envelope?.toolCalls ?? envelope?.tool_calls ?? []);
  const replyText =
    typeof envelope?.reply === 'string' && envelope.reply.trim() ? envelope.reply : first.text.trim();

  const readResults: { name: string; ok: boolean; output: string }[] = [];
  for (const invocation of invocations) {
    const tool = getTool(invocation.name);
    if (!tool || tool.kind !== 'read') continue;
    try {
      const output = await tool.run(invocation.args, state, analytics);
      readResults.push({ name: tool.name, ok: true, output });
    } catch (error) {
      readResults.push({
        name: tool.name,
        ok: false,
        output: error instanceof Error ? error.message : 'Tool failed',
      });
    }
  }

  let text = replyText;

  // One bounded follow-up pass so the model can answer using fresh tool output.
  if (readResults.length) {
    const followUp = await callAI(
      state.settings.ai,
      [
        ...turns,
        { role: 'assistant', content: first.text },
        {
          role: 'system',
          content: `TOOL RESULTS:\n${readResults
            .map((result) => `### ${result.name} (${result.ok ? 'ok' : 'failed'})\n${result.output}`)
            .join('\n\n')}`,
        },
        {
          role: 'user',
          content: 'Using those tool results, give the final answer now. Reply with the same JSON contract.',
        },
      ],
      input.signal,
    );

    if (followUp.ok) {
      const followEnvelope = extractJson(followUp.text) as ModelEnvelope | null;
      if (typeof followEnvelope?.reply === 'string' && followEnvelope.reply.trim()) {
        text = followEnvelope.reply;
      } else if (followUp.text.trim()) {
        text = followUp.text.trim();
      }
    }
  }

  return {
    text,
    pending: toPending(invocations, state),
    toolResults: readResults,
    local: false,
  };
}

/* --------------------------------------------------------------------- *
 * Offline planner — used when no provider is configured or it is down.
 * Deterministic, rule-based, and bilingual (English / বাংলা).
 * --------------------------------------------------------------------- */

type Locale = 'en' | 'bn';

const STRINGS = {
  en: {
    title: 'Study plan for today',
    budget: 'Budget',
    remaining: 'remaining',
    done: 'done',
    planHeader: 'Suggested order',
    revisionHeader: 'Revision queue',
    revisionEmpty: 'Nothing is due for revision — good place to be.',
    weakHeader: 'Weakest areas',
    progressHeader: 'Where you stand',
    nextHeader: 'Do this next',
    streak: 'Streak',
    overall: 'Overall',
    tasks: 'Tasks today',
    sessions: 'Study time',
    propose: 'I can add these to your planner — confirm below.',
    questionsHeader: 'Revision questions to test yourself',
    interviewHeader: 'Likely interview questions',
    offline: 'Offline planner',
    emptyPlan: 'No tasks are planned for today. Say “plan my day” and I will draft one.',
    noData: 'There is not enough data yet. Load the sample data or add a few tasks and topics first.',
  },
  bn: {
    title: 'আজকের পড়ার পরিকল্পনা',
    budget: 'বাজেট',
    remaining: 'বাকি',
    done: 'শেষ',
    planHeader: 'সাজেস্টেড ক্রম',
    revisionHeader: 'রিভিশন তালিকা',
    revisionEmpty: 'এই মুহূর্তে রিভিশনের কিছু বাকি নেই — ভালো জায়গায় আছো।',
    weakHeader: 'দুর্বল বিষয়গুলো',
    progressHeader: 'তোমার অবস্থান',
    nextHeader: 'এখন এটা করো',
    streak: 'স্ট্রিক',
    overall: 'সামগ্রিক',
    tasks: 'আজকের কাজ',
    sessions: 'পড়ার সময়',
    propose: 'চাইলে এগুলো প্ল্যানারে যোগ করতে পারি — নিচে কনফার্ম করো।',
    questionsHeader: 'নিজেকে যাচাই করার প্রশ্ন',
    interviewHeader: 'ইন্টারভিউতে আসতে পারে',
    offline: 'অফলাইন প্ল্যানার',
    emptyPlan: 'আজকের জন্য কোনো কাজ প্ল্যান করা নেই। “আজকের প্ল্যান দাও” বলো, আমি একটা বানিয়ে দিচ্ছি।',
    noData: 'এখনো যথেষ্ট ডেটা নেই। স্যাম্পল ডেটা লোড করো বা কিছু টপিক ও কাজ যোগ করো।',
  },
} as const;

function detectLocale(message: string): Locale {
  return /[\u0980-\u09FF]/.test(message) ? 'bn' : 'en';
}

type Intent = 'plan' | 'progress' | 'weak' | 'questions' | 'notes' | 'general';

function detectIntent(message: string): Intent {
  const text = message.toLowerCase();
  if (/plan|today|routine|schedule|কী পড়া|পড়ব|প্ল্যান|আজকে|আজকের/.test(text)) return 'plan';
  if (/progress|summary|summar|report|কতটা|অগ্রগতি|সার/.test(text)) return 'progress';
  if (/weak|weakness|improve|durbhol|improve|backlog|revision|রিভিশন|দুর্বল/.test(text)) return 'weak';
  if (/question|interview|quiz|প্রশ্ন|ইন্টারভিউ/.test(text)) return 'questions';
  if (/note|notes|summarise topic|নোট/.test(text)) return 'notes';
  return 'general';
}

function priorityWeight(priority: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority as 'critical'] ?? 2;
}

function planOffline(message: string, state: AppState, analytics: Analytics): AssistantResult {
  const locale = detectLocale(message);
  const t = STRINGS[locale];
  const intent = detectIntent(message);

  const pending = analytics.today.tasks
    .filter((task) => task.status === 'pending' || task.status === 'in-progress')
    .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));

  const remaining = analytics.today.remainingMinutes;
  const sections: string[] = [];

  const header =
    intent === 'progress' ? t.progressHeader : intent === 'weak' ? t.weakHeader : t.title;
  sections.push(`## ${header}`);

  const hasData = state.topics.length + state.tasks.length + state.courses.length > 0;
  if (!hasData) {
    sections.push(t.noData);
    return { text: sections.join('\n\n'), pending: [], toolResults: [], local: true };
  }

  if (intent !== 'progress') {
    sections.push(
      `- **${t.overall}:** ${analytics.overall}%`,
      `- **${t.tasks}:** ${analytics.todayTaskStats.completed}/${analytics.todayTaskStats.total} ${t.done}`,
      `- **${t.sessions}:** ${formatMinutes(analytics.minutesToday)} ${t.done} · ${formatMinutes(Math.max(0, remaining))} ${t.remaining} (${t.budget}: ${formatMinutes(analytics.targetToday)})`,
      `- **${t.streak}:** 🔥 ${analytics.streak.current} · longest ${analytics.streak.longest}`,
    );
  }

  if (intent === 'plan' || intent === 'general') {
    sections.push(`### ${t.planHeader}`);
    if (!pending.length) {
      sections.push(t.emptyPlan);
    } else {
      let budget = Math.max(remaining, 0);
      let clock = 0;
      for (const task of pending.slice(0, 6)) {
        const minutes = Math.max(15, task.plannedMinutes);
        clock += minutes;
        budget -= minutes;
        const flag = budget < 0 ? ' ⚠️' : '';
        sections.push(
          `${clock - minutes}–${clock} min · **${task.title}** — ${task.subject} · ${formatMinutes(minutes)} · ${task.priority}${flag}`,
        );
      }
      if (budget < 0) {
        sections.push(
          `> ${t.remaining}: ${formatMinutes(Math.abs(budget))} over budget. Push the lowest-priority items to tomorrow.`,
        );
      }
    }
  }

  if (intent === 'weak' || intent === 'general' || intent === 'plan') {
    sections.push(`### ${t.revisionHeader}`);
    if (!analytics.revisionTopics.length) {
      sections.push(t.revisionEmpty);
    } else {
      sections.push(
        ...analytics.revisionTopics
          .slice(0, 6)
          .map(
            (topic) =>
              `- **${topic.name}** (${topic.category}) — confidence ${topic.confidence}/5${
                topic.nextRevisionAt ? ` · due ${topic.nextRevisionAt}` : ''
              }`,
          ),
      );
    }

    const weak = [...analytics.categoryProgress].sort((a, b) => a.progress - b.progress).slice(0, 4);
    if (weak.length) {
      sections.push(
        `### ${t.weakHeader}`,
        ...weak.map((entry) => `- ${entry.subject} — ${entry.progress}% (${entry.completed}/${entry.total} complete)`),
      );
    }
  }

  if (intent === 'questions') {
    const targets = analytics.revisionTopics.slice(0, 4);
    sections.push(
      `### ${t.interviewHeader}`,
      ...(targets.length
        ? targets.map((topic) => questionFor(topic.name, topic.category))
        : ['- Add topics first so I can generate targeted questions.']),
    );
  }

  if (intent === 'notes') {
    const target = analytics.revisionTopics[0] ?? state.topics[0];
    if (target) {
      sections.push(
        `### Note outline — ${target.name}`,
        '- **Definition** — one sentence, in your own words.',
        '- **Commands** — the 5 commands you actually use, with flags explained.',
        '- **Example** — the smallest working example.',
        '- **Common mistakes** — what you got wrong last time.',
        '- **Interview questions** — 3 questions you would struggle to answer today.',
        '- **My notes** — the mental model, not the syntax.',
      );
    }
  }

  if (intent !== 'progress') {
    sections.push(`### ${t.nextHeader}`);
    const focuses: string[] = [];
    if (pending[0]) focuses.push(`Start with **${pending[0].title}** for ${formatMinutes(pending[0].plannedMinutes)}.`);
    if (analytics.revisionTopics[0]) focuses.push(`Then revise **${analytics.revisionTopics[0].name}** (25 min).`);
    const stalled = analytics.courseSummaries.filter((entry) => entry.progress > 0 && entry.progress < 100)[0];
    if (stalled) focuses.push(`Continue **${stalled.course.name}** — ${stalled.remainingModules} module(s) left.`);
    if (analytics.minutesToday >= analytics.targetToday) focuses.push('Daily target already hit — bank the win and rest.');
    sections.push(...(focuses.length ? focuses.map((line) => `- ${line}`) : ['- Nothing urgent. Review a note and keep the streak alive.']));
  }

  const pendingTools: PendingToolCall[] = [];
  if (locale === 'en' && (intent === 'plan' || intent === 'general')) {
    const revisionToSchedule = analytics.revisionTopics.filter(
      (topic) => !analytics.today.tasks.some((task) => task.title.toLowerCase().includes(topic.name.toLowerCase())),
    );
    for (const topic of revisionToSchedule.slice(0, 2)) {
      const args: ToolArgs = {
        title: `Revise ${topic.name}`,
        date: analytics.today.date,
        subject: topic.category,
        topic: topic.name,
        plannedMinutes: 25,
        priority: topic.confidence <= 2 ? 'high' : 'medium',
        notes: 'Scheduled by the offline planner.',
      };
      pendingTools.push({
        id: uid('ptc'),
        name: 'createTask',
        args,
        summary: describeInvocation({ name: 'createTask', args }, state),
        destructive: false,
      });
    }
    if (pendingTools.length) sections.push(`> 🤖 ${t.propose}`);
  }

  return { text: sections.join('\n\n'), pending: pendingTools, toolResults: [], local: true };
}

function questionFor(name: string, category: string): string {
  const bank: Record<string, string> = {
    Kubernetes:
      '- How does a Service find its Pods, and what happens when the selector matches nothing?\n- Difference between a Deployment and a StatefulSet — and when is each wrong?',
    Terraform:
      '- What is stored in Terraform state, and why is committing it dangerous?\n- How does state locking prevent two engineers applying at once?',
    Docker:
      '- Walk through the difference between a bind mount and a named volume.\n- Why does a multi-stage build produce a smaller image?',
    AWS:
      '- Design a three-tier VPC. Where does the NAT Gateway go, and why?\n- When do you choose IAM roles over IAM users?',
    Jenkins:
      '- Declarative vs scripted pipeline — what do you lose with declarative?\n- How do you cache dependencies between builds?',
    Monitoring:
      '- Which four golden signals would you alert on for this service?\n- Counter vs gauge vs histogram — pick one for request latency.',
  };
  return bank[category] ?? `- Explain ${name} to a junior engineer in under two minutes.\n- What breaks first in production, and how would you detect it?`;
}

/** Produces the cold-start greeting shown when the chat opens. */
export function greetingMessage(analytics: Analytics, name: string): string {
  const who = name ? name.split(' ')[0] : 'there';
  return [
    `👋 Hi ${who}. I can see your whole learning profile.`,
    '',
    `- **Overall progress:** ${analytics.overall}%`,
    `- **Today:** ${formatMinutes(analytics.minutesToday)} of ${formatMinutes(analytics.targetToday)} (${analytics.todayProgress}%)`,
    `- **Streak:** 🔥 ${analytics.streak.current} day(s)`,
    `- **Revision queue:** ${analytics.revisionTopics.length} topic(s)`,
    '',
    'Ask me things like:',
    '- “আমার আজকে কী পড়া উচিত?”',
    '- “Analyse my progress this week.”',
    '- “Generate revision questions for Kubernetes.”',
    '- “Explain my weak areas and build a 3-day plan.”',
  ].join('\n');
}
