import { apiClient } from '../../api/axiosConfig';

/**
 * Agent Dola (`/api/agent-dola/*`), for now inside Team work only: anyone off the team gets a 404 and sees no Dola.
 * Every change Dola proposes comes back with an `actionId` and a `proposal` card; nothing changes until the person
 * confirms it. Replies are coerced into the shape the UI renders: malformed parts are dropped, never interpreted.
 */
export type AgentDolaStatusCode =
    | 'NEEDS_CLARIFICATION' | 'NOT_ALLOWED' | 'ASSISTANT_UNAVAILABLE' | 'HELP' | 'INFO' | 'ACTION_CONFIRMATION_REQUIRED'
    | 'ACTION_COMPLETED' | 'ACTION_DECLINED' | 'ACTION_FAILED' | 'CHAT' | 'RATE_LIMITED' | (string & {});
export interface AgentDolaLink { label: string; webPath: string | null }
export interface AgentDolaCard { title: string; subtitle: string | null; link: AgentDolaLink | null }
export interface AgentDolaProposal { title: string; details: { label: string; value: string }[]; confirmLabel: string; expiresAt: string }
/** How Dola understood one message: the route, the details read from it, the Jev and writer calls, the time, and why it asked or refused. */
export interface AgentDolaTrace {
    route: string | null; confidence: number | null; runnerUp: string | null; direct: number | null;
    slots: { name: string; value: string }[]; jevCalls: number; writerCalls: number; millis: number; why: string | null;
}
export interface AgentDolaReply {
    status: AgentDolaStatusCode; reply: string; tool: string | null; actionId: string | null; proposal: AgentDolaProposal | null;
    cards: AgentDolaCard[]; navigation: AgentDolaLink | null; quickReplies: string[]; language: 'en' | 'ka' | null;
    /** Only when the request asked for it (`trace: true`), and only for team members. */
    trace: AgentDolaTrace | null;
}
export interface AgentDolaTurn { at: string; message: string; answer: AgentDolaReply | null }
/** `reason` says why Dola is unavailable — SWITCHED_OFF, NO_LANGUAGE_KEY or LANGUAGE_KEY_REJECTED — and is null when it is available. */
export interface AgentDolaStatus { available: boolean; maxMessageLength: number; writer: boolean; reason: string | null }
export interface AgentDolaOptions { trace?: boolean }

const ACTION_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const text = (value: unknown, max = 20000): string => typeof value === 'string' ? value.slice(0, max) : '';
const optionalText = (value: unknown, max = 2000): string | null => typeof value === 'string' && value.trim() ? value.slice(0, max) : null;
const record = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const records = (value: unknown): Record<string, unknown>[] =>
    (Array.isArray(value) ? value.slice(0, 50) : []).map(record).filter((item): item is Record<string, unknown> => item !== null);
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
const score = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
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
            details: records(proposal.details).map(detail => ({ label: text(detail.label, 200), value: text(detail.value, 2000) })),
        } : null,
        cards: records(item.cards).slice(0, 12).map(card => ({ title: text(card.title, 300), subtitle: optionalText(card.subtitle, 500), link: link(card.link) })),
        navigation: link(item.navigation),
        quickReplies: (Array.isArray(item.quickReplies) ? item.quickReplies : []).filter((reply): reply is string => typeof reply === 'string' && !!reply.trim())
            .map(reply => reply.slice(0, 300)).slice(0, 6),
        language: item.language === 'ka' ? 'ka' : item.language === 'en' ? 'en' : null,
        trace: trace(item.trace),
    };
}

/** HTTP 429 carries a normal RATE_LIMITED reply that the person should see, not an error. */
async function reply(call: () => Promise<{ data: unknown }>): Promise<AgentDolaReply> {
    try { return normalizeAgentDolaReply((await call()).data); }
    catch (cause) {
        const response = (cause as { response?: { status?: number; data?: unknown } } | null)?.response;
        if (response?.status === 429 && record(response.data)?.status === 'RATE_LIMITED') return normalizeAgentDolaReply(response.data);
        throw cause;
    }
}

const base = '/agent-dola';
/** The trace is asked for only when the person turned it on; the server sends it to team members only. */
const traced = (options: AgentDolaOptions) => options.trace ? { params: { trace: true } } : undefined;

export const agentDolaStatus = async (signal?: AbortSignal): Promise<AgentDolaStatus> => {
    const data = record((await apiClient.get(`${base}/status`, { signal })).data) ?? {};
    return {
        available: data.available === true, maxMessageLength: typeof data.maxMessageLength === 'number' ? data.maxMessageLength : 2000,
        writer: data.writer === true, reason: optionalText(data.reason, 64),
    };
};

export const agentDolaConversation = async (signal?: AbortSignal): Promise<AgentDolaTurn[]> =>
    records((await apiClient.get(`${base}/conversation`, { signal })).data).map(turn => ({
        at: text(turn.at, 64), message: text(turn.message, 8000), answer: turn.answer ? normalizeAgentDolaReply(turn.answer) : null,
    }));

export const sendAgentDola = (message: string, pagePath?: string, options: AgentDolaOptions = {}) => {
    let timeZone: string | undefined;
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { timeZone = undefined; }
    return reply(() => apiClient.post(`${base}/messages`, { message, timeZone, pagePath: pagePath && pagePath.length <= 300 ? pagePath : undefined }, traced(options)));
};

export const decideAgentDola = (actionId: string, decision: 'confirm' | 'reject', options: AgentDolaOptions = {}) =>
    reply(() => apiClient.post(`${base}/actions/${encodeURIComponent(actionId)}/${decision}`, {}, decision === 'confirm' ? traced(options) : undefined));

export const forgetAgentDola = () => apiClient.delete(`${base}/conversation`).then(() => undefined);
