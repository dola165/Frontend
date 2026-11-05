/**
 * Agent Dola's panel lives once for the whole app; these signals connect it to the rest: the header asks it to open
 * (a first-time tip also asks a question as it opens), and it tells the page when an approved action changed something
 * (Team work reloads its board).
 */
export const AGENT_DOLA_OPEN = 'agent-dola:open';
export const AGENT_DOLA_CHANGED = 'agent-dola:changed';
/** Sent with AGENT_DOLA_OPEN: the question to ask as the panel opens, if any. */
export interface AgentDolaOpenRequest { ask?: string }

export const openAgentDola = (ask?: string) =>
    window.dispatchEvent(new CustomEvent<AgentDolaOpenRequest>(AGENT_DOLA_OPEN, { detail: ask?.trim() ? { ask: ask.trim() } : {} }));
export const notifyAgentDolaChanged = () => window.dispatchEvent(new Event(AGENT_DOLA_CHANGED));
