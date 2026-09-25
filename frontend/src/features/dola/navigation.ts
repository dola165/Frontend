import type { AuthSessionId } from '../../utils/authStorage';

/** Conservative, local routing only. Typing never calls an AI provider. */
export function isDolaQuestion(text: string): boolean {
    const query = text.trim().toLocaleLowerCase();
    if (query.length < 4) return false;
    if (/^(?:@?agent\s+dola|@dola|ჰკითხე\s+დოლას)(?:\s|[:,])/u.test(query)) return true;
    if (/^["“@]/u.test(query)) return false;
    return /^(?:how|why|where|when|what|who|which)\s+(?:do|does|did|is|are|was|were|will|would|should|can|could|has|have|to|much|many|long|often|soon)\b/u.test(query)
        || /^(?:how|why|where|when|what|who|which)\s+.+\?$/u.test(query)
        || /^(?:can|could|would|should|do|does|did|is|are|will)\s+(?:i|we|you|my|our|the|there|it|a|an|this|that)\b/u.test(query)
        || /^(?:help me|tell me|explain|show me how|i need help|i want to know)\s+\S+/u.test(query)
        || /^(?:როგორ|რატომ|სად|როდის|რომელი|ვინ|რა|შემიძლია|შეგიძლია|დამეხმარე|ამიხსენი)(?:\s|[?])/u.test(query);
}

export type DolaHandoff = { message: string; requestId: string; sessionId: AuthSessionId };
export function dolaNavigationState(message: string, sessionId: AuthSessionId) {
    return { dolaQuestion: { message: message.trim().slice(0, 2000), requestId: crypto.randomUUID(), sessionId } };
}
export function readDolaHandoff(state: unknown, sessionId: AuthSessionId): DolaHandoff | null {
    const handoff = (state as { dolaQuestion?: Partial<DolaHandoff> } | null)?.dolaQuestion;
    if (!sessionId || !handoff || handoff.sessionId !== sessionId || typeof handoff.message !== 'string'
        || !handoff.message.trim() || handoff.message.length > 2000 || typeof handoff.requestId !== 'string'
        || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(handoff.requestId)) return null;
    return handoff as DolaHandoff;
}
