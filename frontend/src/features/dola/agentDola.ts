import { isAndroidApp } from '../../android/bridge';
import { apiClient } from '../../api/axiosConfig';
import { currentGuide } from './dolaGuide';
import { readPageForm } from './pageForm';

/**
 * Agent Dola (`/api/agent-dola/*`), the GrassKickZ assistant, for every signed-in customer (each role its own Dola). Every
 * change Dola proposes comes back with an `actionId` and a `proposal` card; nothing changes until the person confirms it.
 * A message can carry a picture uploaded first (`uploadAgentDolaPicture`). Replies are coerced into the shape the UI
 * renders: malformed parts are dropped, never interpreted.
 */
export type AgentDolaStatusCode =
    | 'NEEDS_CLARIFICATION' | 'NOT_ALLOWED' | 'ASSISTANT_UNAVAILABLE' | 'HELP' | 'INFO' | 'ACTION_CONFIRMATION_REQUIRED'
    | 'CONFIRMATION_REQUIRED' | 'NOTIFICATION_CONFIRMATION_REQUIRED' | 'NOTIFICATION_SENT' | 'MATCH_LIST' | 'WEB_RESULTS'
    | 'ACTION_COMPLETED' | 'ACTION_DECLINED' | 'ACTION_FAILED' | 'CHAT' | (string & {});
/** Statuses of a preview that waits for the person's approval: any action, a match cancellation, a team notification. */
const AWAITING = new Set(['ACTION_CONFIRMATION_REQUIRED', 'CONFIRMATION_REQUIRED', 'NOTIFICATION_CONFIRMATION_REQUIRED']);
export const awaitsApproval = (status: string) => AWAITING.has(status);
export interface AgentDolaLink { label: string; webPath: string | null }
export interface AgentDolaCard { title: string; subtitle: string | null; link: AgentDolaLink | null }
/** `pictureUrl` is the picture the action uses (one the person sent), shown on the review card. */
export interface AgentDolaProposal { title: string; details: { label: string; value: string }[]; confirmLabel: string; expiresAt: string; pictureUrl?: string | null }
/** One field to fill during a guide: how to find it on the page, its name, and why it matters. */
export interface AgentDolaGuideStep { target: string; label: string; hint: string | null; required: boolean }
/**
 * A walk through what is still missing: open `webPath` (or stay, when null), frame each step's field, Next. With `scan`
 * the page is read for its empty fields once it is open (Dola knows the page but not its fields).
 */
export interface AgentDolaGuide { title: string; webPath: string | null; scan: boolean; steps: AgentDolaGuideStep[] }
/** A web page behind a web-search answer: third-party information, opened in a new tab. */
export interface AgentDolaSource { title: string; url: string; snippet: string | null }
/** How Dola understood one message: the route, the details read from it, the Jev and writer calls, the time, and why it asked or refused. */
export interface AgentDolaTrace {
    route: string | null; confidence: number | null; runnerUp: string | null; direct: number | null;
    slots: { name: string; value: string }[]; jevCalls: number; writerCalls: number; millis: number; why: string | null;
}
export interface AgentDolaReply {
    status: AgentDolaStatusCode; reply: string; tool: string | null; actionId: string | null; proposal: AgentDolaProposal | null;
    cards: AgentDolaCard[]; navigation: AgentDolaLink | null; quickReplies: string[]; language: 'en' | 'ka' | 'et' | 'ru' | null;
    sources: AgentDolaSource[];
    guide: AgentDolaGuide | null;
    /** Only when the request asked for it (`trace: true`), and only for team members. */
    trace: AgentDolaTrace | null;
}
/** `pictureUrl` is the picture the person sent with the message. */
export interface AgentDolaTurn { at: string; message: string; answer: AgentDolaReply | null; pictureUrl?: string | null }
/** A picture sent to Dola: its `id` goes with the next message; only the sender can see `url`. */
export interface AgentDolaPicture { id: number; url: string }
/** `reason` says why Dola is unavailable — SWITCHED_OFF, NO_LANGUAGE_KEY or LANGUAGE_KEY_REJECTED — and is null when it is available. */
/** `welcome` and `examples` are the person's own: what Dola does for their role, in the asked language. */
/** `pictures`: pictures can be sent; `readsPictures`: Dola can also read what is in them. */
export interface AgentDolaStatus {
    available: boolean; maxMessageLength: number; writer: boolean; reason: string | null; welcome: string; examples: string[];
    pictures?: boolean; readsPictures?: boolean;
    /** Team members only: why written answers fail until someone acts on the writer's account (NO_BALANCE, KEY_REJECTED). */
    writerProblem?: string | null;
}
/** `pictureId` sends a picture uploaded with `uploadAgentDolaPicture` along with the message. */
export interface AgentDolaOptions { trace?: boolean; pictureId?: number }

const ACTION_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const text = (value: unknown, max = 20000): string => typeof value === 'string' ? value.slice(0, max) : '';
const optionalText = (value: unknown, max = 2000): string | null => typeof value === 'string' && value.trim() ? value.slice(0, max) : null;
const record = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const records = (value: unknown): Record<string, unknown>[] =>
    (Array.isArray(value) ? value.slice(0, 50) : []).map(record).filter((item): item is Record<string, unknown> => item !== null);
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
const score = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
/** Web sources must be plain http(s) addresses; anything else (a script URL, a malformed one) is dropped. */
const webUrl = (value: unknown): string | null => {
    const url = optionalText(value, 2048);
    if (!url) return null;
    try { return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null; } catch { return null; }
};
/** Pictures are only the app's own uploads; anything else is dropped, never shown. */
const uploadPath = (value: unknown): string | null => {
    const path = optionalText(value, 512);
    return path && /^\/uploads\/[\w-]+\.jpg$/.test(path) ? path : null;
};
/** Only app paths become links; anything else (another site, a script URL) is dropped. */
const appPath = (value: unknown): string | null => {
    const path = optionalText(value, 2048);
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
};

function link(value: unknown): AgentDolaLink | null {
    const item = record(value);
    if (!item) return null;
    return { label: text(item.label, 200), webPath: appPath(item.webPath) };
}

function trace(value: unknown): AgentDolaTrace | null {
    const item = record(value);
    if (!item) return null;
    return {
        route: optionalText(item.route, 200), confidence: score(item.confidence), runnerUp: optionalText(item.runnerUp, 100), direct: score(item.direct),
        slots: Object.entries(record(item.slots) ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string').slice(0, 12)
            .map(([name, slot]) => ({ name: name.slice(0, 60), value: slot.slice(0, 200) })),
        jevCalls: count(item.jevCalls), writerCalls: count(item.writerCalls), millis: count(item.millis), why: optionalText(item.why, 500),
    };
}

function guide(value: unknown): AgentDolaGuide | null {
    const item = record(value);
    if (!item) return null;
    const steps = records(item.steps).slice(0, 20).flatMap(step => {
        const target = optionalText(step.target, 160);
        return target ? [{ target, label: text(step.label, 200) || target, hint: optionalText(step.hint, 500), required: step.required === true }] : [];
    });
    const scan = item.scan === true;
    return steps.length || scan ? { title: text(item.title, 200), webPath: appPath(item.webPath), scan, steps } : null;
}

export function normalizeAgentDolaReply(value: unknown): AgentDolaReply {
    const item = record(value) ?? {};
    const actionId = typeof item.actionId === 'string' && ACTION_ID.test(item.actionId) ? item.actionId : null;
    const proposal = actionId ? record(item.proposal) : null;
    return {
        status: text(item.status, 64) || 'INFO',
        reply: text(item.reply),
        tool: optionalText(item.tool, 100),
        actionId,
        proposal: proposal ? {
            title: text(proposal.title, 300), confirmLabel: text(proposal.confirmLabel, 100), expiresAt: text(proposal.expiresAt, 64),
            pictureUrl: uploadPath(proposal.pictureUrl),
            details: records(proposal.details).map(detail => ({ label: text(detail.label, 200), value: text(detail.value, 2000) })),
        } : null,
        cards: records(item.cards).slice(0, 12).map(card => ({ title: text(card.title, 300), subtitle: optionalText(card.subtitle, 500), link: link(card.link) })),
        navigation: link(item.navigation),
        quickReplies: (Array.isArray(item.quickReplies) ? item.quickReplies : []).filter((reply): reply is string => typeof reply === 'string' && !!reply.trim())
            .map(reply => reply.slice(0, 300)).slice(0, 6),
        language: item.language === 'ka' || item.language === 'en' || item.language === 'et' || item.language === 'ru' ? item.language : null,
        sources: records(item.sources).slice(0, 8).flatMap(source => {
            const url = webUrl(source.url);
            return url ? [{ title: text(source.title, 300) || url, url, snippet: optionalText(source.snippet, 500) }] : [];
        }),
        guide: guide(item.guide),
        trace: trace(item.trace),
    };
}

/** Every reply, coerced into the shape the panel renders. Dola never asks a customer to wait: there is no limit reply. */
async function reply(call: () => Promise<{ data: unknown }>): Promise<AgentDolaReply> {
    return normalizeAgentDolaReply((await call()).data);
}

const base = '/agent-dola';
/** The trace is asked for only when the person turned it on; the server sends it to team members only. */
const traced = (options: AgentDolaOptions) => options.trace ? { params: { trace: true } } : undefined;

export const agentDolaStatus = async (signal?: AbortSignal, language?: 'en' | 'ka'): Promise<AgentDolaStatus> => {
    const data = record((await apiClient.get(`${base}/status`, { signal, params: language ? { lang: language } : undefined })).data) ?? {};
    return {
        available: data.available === true, maxMessageLength: typeof data.maxMessageLength === 'number' ? data.maxMessageLength : 2000,
        writer: data.writer === true, reason: optionalText(data.reason, 64), welcome: text(data.welcome, 1000),
        examples: Array.isArray(data.examples) ? data.examples.map(example => text(example, 200)).filter(Boolean).slice(0, 8) : [],
        pictures: data.pictures === true, readsPictures: data.readsPictures === true, writerProblem: optionalText(data.writerProblem, 64),
    };
};

export const agentDolaConversation = async (signal?: AbortSignal): Promise<AgentDolaTurn[]> =>
    records((await apiClient.get(`${base}/conversation`, { signal })).data).map(turn => ({
        at: text(turn.at, 64), message: text(turn.message, 8000), answer: turn.answer ? normalizeAgentDolaReply(turn.answer) : null,
        pictureUrl: uploadPath(turn.pictureUrl),
    }));

/** Keeps a picture for the next message (checked, resized, only the sender sees it; gone when the chat ends). */
export const uploadAgentDolaPicture = async (file: File): Promise<AgentDolaPicture> => {
    const body = new FormData();
    body.append('file', file);
    const data = record((await apiClient.post(`${base}/pictures`, body, { headers: { 'Content-Type': 'multipart/form-data' } })).data) ?? {};
    const url = uploadPath(data.url);
    if (typeof data.id !== 'number' || !url) throw new Error('The picture did not upload.');
    return { id: data.id, url };
};

/** What Dola is doing while it answers: a step ("Checking your calendar…") replaces the last; words add to the answer so far. */
export interface AgentDolaProgress { step: (text: string) => void; words: (text: string) => void }

/** The line limit is generous: a whole reply is one line. */
const MAX_STREAM_BUFFER = 512_000;

/**
 * The message with its progress as it happens, one JSON object per line. The same client as every other call, so the
 * session, the renewal of an expired token and the security rules are the same. Empty when the stream can't start (an
 * older server, Android's native client); the caller then sends the plain request. A stream that breaks part way has
 * still reached the server, which finishes the message whoever is listening: the chat holds its answer.
 */
async function streamedReply(body: unknown, message: string, options: AgentDolaOptions, progress: AgentDolaProgress): Promise<AgentDolaReply | null> {
    if (isAndroidApp) return null;
    let stream: ReadableStream<Uint8Array> | undefined;
    try {
        const response = await apiClient.post<ReadableStream<Uint8Array>>(`${base}/messages/stream`, body,
            { ...traced(options), adapter: 'fetch', responseType: 'stream', headers: { Accept: 'application/x-ndjson, application/json' } });
        stream = response.data;
    } catch { return null; }
    if (typeof stream?.getReader !== 'function') return null;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const result: { answer: AgentDolaReply | null; failed: boolean } = { answer: null, failed: false };
    const consume = (line: string) => {
        if (!line.trim()) return;
        const event = record(JSON.parse(line));
        if (event?.type === 'step' && typeof event.text === 'string') progress.step(event.text.slice(0, 200));
        else if (event?.type === 'text' && typeof event.text === 'string') progress.words(event.text);
        else if (event?.type === 'reply') result.answer = normalizeAgentDolaReply(event.reply);
        else if (event?.type === 'error') { result.failed = true; throw new Error('Dola could not finish this answer.'); }
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            if (buffer.length > MAX_STREAM_BUFFER) throw new Error('Dola returned an oversized response.');
            let newline: number;
            while ((newline = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
            if (done) { consume(buffer); break; }
        }
    } catch (failure) {
        if (result.failed) throw failure;
        return answerFromTheChat(message);
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return result.answer ?? answerFromTheChat(message);
}

/** The answer to this message, from the chat: the server keeps the chat's lock until the message is done, so this waits for it. */
async function answerFromTheChat(message: string): Promise<AgentDolaReply> {
    const turns = await agentDolaConversation();
    const answer = [...turns].reverse().find(turn => turn.message === message)?.answer;
    if (!answer) throw new Error('The connection ended before Dola finished.');
    return answer;
}

/** @param progress given, the answer comes with its steps and words as they happen (the plain reply otherwise). */
export const sendAgentDola = async (message: string, pagePath?: string, options: AgentDolaOptions = {}, progress?: AgentDolaProgress) => {
    let timeZone: string | undefined;
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { timeZone = undefined; }
    // The form on screen goes along (labels and whether each field is filled, never values) for "what's missing here?",
    // with the field Dola's guide is framing, so "what is this?" is about that field.
    let page: ReturnType<typeof readPageForm> = null;
    try { page = readPageForm(); } catch { page = null; }
    const guide = currentGuide();
    const step = guide?.steps[guide.index];
    const focus = step ? { key: step.target.slice(0, 160), label: step.label.slice(0, 200), guide: guide?.guide.title?.slice(0, 200) || undefined } : undefined;
    const body = { message, timeZone, pagePath: pagePath && pagePath.length <= 300 ? pagePath : undefined,
        page: page || focus ? { title: page?.title ?? null, fields: page?.fields ?? [], focus } : undefined,
        pictureId: options.pictureId };
    const streamed = progress ? await streamedReply(body, message, options, progress) : null;
    return streamed ?? reply(() => apiClient.post(`${base}/messages`, body, traced(options)));
};

export const decideAgentDola = (actionId: string, decision: 'confirm' | 'reject', options: AgentDolaOptions = {}) =>
    reply(() => apiClient.post(`${base}/actions/${encodeURIComponent(actionId)}/${decision}`, {}, decision === 'confirm' ? traced(options) : undefined));

export const forgetAgentDola = () => apiClient.delete(`${base}/conversation`).then(() => undefined);
