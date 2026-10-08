import { getAuthSessionId, getStoredAccessToken, getStoredUserId } from '../../utils/authStorage';
import { isAndroidApp } from '../../android/bridge';

export interface ReplyScope { actorId: number; sessionId: string | null }
export interface UncertainReply extends ReplyScope {
    squadId: number; occurrenceId: number; playerId: number;
    revision: number; response: string; requestId: string;
}
export const REPLY_RECOVERY_PREFIX = 'gk-availability-uncertain:';
export class ReplyRecoveryError extends Error {}
const MAX_PENDING = 64;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;

/** The authenticated request still receives server-side current authority checks. */
export function replyScope(): ReplyScope | null {
    try {
        // The native shell deliberately keeps JWTs out of JavaScript. Its
        // authenticated bootstrap supplies this ID, the WebView origin belongs
        // to that account, and its existing transport rejects retired native epochs.
        if (isAndroidApp) {
            const actorId = Number(getStoredUserId());
            if (!positive(actorId) || !window.location.hostname.endsWith(`-account-${actorId}.appassets.androidplatform.net`)) return null;
            return { actorId, sessionId: getAuthSessionId() };
        }
        const token = getStoredAccessToken();
        const subject: unknown = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
        const actorId = Number(subject);
        if (!positive(actorId) || String(actorId) !== getStoredUserId()) return null;
        return { actorId, sessionId: getAuthSessionId() };
    } catch { return null; }
}
const key = (scope: ReplyScope, squad: number, occurrence: number, player: number) =>
    `${REPLY_RECOVERY_PREFIX}${scope.sessionId ?? 'legacy'}:${scope.actorId}:${squad}:${occurrence}:${player}`;
export function requireReplyScope(scope: ReplyScope) {
    const current = replyScope();
    if (!current || current.actorId !== scope.actorId || current.sessionId !== scope.sessionId)
        throw new ReplyRecoveryError('Your account changed. Reopen the session before replying.');
}
export function readUncertainReply(scope: ReplyScope, squad: number, occurrence: number, player: number): UncertainReply | null {
    requireReplyScope(scope);
    const raw = localStorage.getItem(key(scope, squad, occurrence, player));
    if (raw === null) return null;
    try {
        const v = JSON.parse(raw) as UncertainReply;
        if (v.actorId !== scope.actorId || v.sessionId !== scope.sessionId || v.squadId !== squad || v.occurrenceId !== occurrence || v.playerId !== player
            || !positive(squad) || !positive(occurrence) || !positive(player) || !Number.isSafeInteger(v.revision) || v.revision < 0
            || !['GOING', 'NOT_GOING', 'UNSURE'].includes(v.response) || !uuid.test(v.requestId)) throw new Error();
        return v;
    } catch { throw new ReplyRecoveryError('The earlier reply could not be recovered. Review a new reply before sending another.'); }
}
/** Persist before dispatch. An uncertain command is never rebound to a later revision. */
export function beginReply(scope: ReplyScope, squadId: number, occurrenceId: number, playerId: number, response: string, revision: number): UncertainReply {
    if (!positive(squadId) || !positive(occurrenceId) || !positive(playerId) || !Number.isSafeInteger(revision) || revision < 0 || !['GOING', 'NOT_GOING', 'UNSURE'].includes(response))
        throw new ReplyRecoveryError('Review the current session before replying.');
    const existing = readUncertainReply(scope, squadId, occurrenceId, playerId);
    if (existing) {
        if (existing.response !== response || existing.revision !== revision)
            throw new ReplyRecoveryError('Retry the earlier reply or review a new reply first.');
        return existing;
    }
    if (Object.keys(localStorage).filter(k => k.startsWith(REPLY_RECOVERY_PREFIX)).length >= MAX_PENDING)
        throw new ReplyRecoveryError('Review your earlier replies before sending another.');
    const command: UncertainReply = { ...scope, squadId, occurrenceId, playerId, response, revision, requestId: crypto.randomUUID() };
    try { localStorage.setItem(key(scope, squadId, occurrenceId, playerId), JSON.stringify(command)); }
    catch { throw new ReplyRecoveryError('Your browser could not retain this reply for recovery. Enable browser storage and try again.'); }
    return command;
}
export function acknowledgeReply(command: UncertainReply) {
    requireReplyScope(command);
    if (readUncertainReply(command, command.squadId, command.occurrenceId, command.playerId)?.requestId === command.requestId)
        localStorage.removeItem(key(command, command.squadId, command.occurrenceId, command.playerId));
}
/** Only an explicit review choice discards an uncertain command without acknowledgement. */
export function reviewNewReply(scope: ReplyScope, squad: number, occurrence: number, player: number) {
    requireReplyScope(scope);
    localStorage.removeItem(key(scope, squad, occurrence, player));
}
