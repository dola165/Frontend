import { useLocation } from 'react-router-dom';
import type { AccessSubject } from '../../api/access';
import { useAuth } from '../../context/AuthContext';
import { useAdultOnly } from '../../hooks/useAdultOnly';
import { useCan } from '../../hooks/useCan';
import { isKnownMinor } from '../../utils/age';
import { useArrangeableSquads } from '../world/compose/useArrangeableSquads';
import { actionHref, type ActionHints, type ActionKey, type ActionSubject } from './registry';
import { useResultsWaiting } from './useResultsWaiting';

export interface ActionState {
    allowed: boolean;
    /** The checker has not answered yet: the screen's own flag stands in. */
    loading: boolean;
    /** Why not, in the server's words (or the app's own while it cannot ask). */
    reason: string | null;
    /** Refused only for a missing birth date: the door offers to add it. */
    needsBirthDate: boolean;
    /** Refused by a rule an admin can lift. */
    askAdmin: boolean;
    /** The current page with the flow open over it; null for Follow (a toggle) or when not allowed. */
    href: string | null;
}

/** Which rule-checker answer an action is asked of: a club or squad asks about itself, everything else about the person. */
export function accessSubjectOf(subject: ActionSubject): AccessSubject {
    if (subject.kind === 'club') return `club:${subject.id}`;
    if (subject.kind === 'squad') return `squad:${subject.id}`;
    if (subject.kind === 'match' && subject.squadId) return `squad:${subject.squadId}`;
    return 'me';
}

/**
 * The flags each screen used before the checker answered for the whole app, kept as the fallback while it loads or
 * when an older server has none: pages and clubs are hidden from someone known to be under 18, a child is added by an
 * adult, a match is arranged for a squad the person may arrange for, a score is offered when one is owed. Staff work
 * is the club screen's own flag (`fallback`), never assumed here.
 */
function useFallback(key: ActionKey, subject: ActionSubject): { allowed: boolean; reason: string | null; needsBirthDate: boolean } {
    const { user, status } = useAuth();
    const guardian = useAdultOnly('guardian');
    const squads = useArrangeableSquads(key === 'arrange_match');
    const waiting = useResultsWaiting(key === 'report_score');
    const signedIn = status === 'authenticated';
    const squad = subject.kind === 'squad' ? subject.id : null;
    switch (key) {
        case 'start_club': return { allowed: signedIn && !isKnownMinor(user?.dob), reason: null, needsBirthDate: false };
        case 'add_child': return { allowed: guardian.allowed, reason: guardian.reason, needsBirthDate: guardian.needsBirthDate };
        case 'join_squad': return { allowed: signedIn, reason: null, needsBirthDate: false };
        case 'follow': return { allowed: signedIn && !(subject.kind === 'person' && subject.id === user?.id), reason: null, needsBirthDate: false };
        case 'arrange_match': return { allowed: Boolean(squads?.some(item => squad === null || item.id === squad)), reason: null, needsBirthDate: false };
        case 'report_score': return { allowed: Boolean(waiting?.some(item => squad === null || item.squadId === squad)), reason: null, needsBirthDate: false };
        default: return { allowed: false, reason: null, needsBirthDate: false };
    }
}

/**
 * "May I do this here, and where does it open?" for one of the eight actions. Built on the rule-checker (`useCan`):
 * its answer decides once it arrives; until then (or without one) the screen's old flag does, or `fallback` when the
 * screen passes its own.
 */
export function useAction(key: ActionKey, subject: ActionSubject = { kind: 'me' }, { hints, fallback, at }: {
    hints?: ActionHints; fallback?: boolean; /** The page to open the flow over, when not this one (the welcome sends it to Home). */ at?: { pathname: string; search: string };
} = {}): ActionState {
    const here = useLocation();
    const location = at ?? here;
    const { status } = useAuth();
    const own = useFallback(key, subject);
    // Signed out, nothing is asked: the server would answer 401 and end the session; the old flags decide.
    const can = useCan(status === 'authenticated' ? accessSubjectOf(subject) : null);
    const decision = can.decide(key, fallback ?? own.allowed);
    const reason = decision.allowed ? null : decision.reason ?? (decision.code ? null : own.reason);
    const needsBirthDate = !decision.allowed && (decision.code ? decision.code === 'BIRTH_DATE_NEEDED' : own.needsBirthDate);
    return {
        allowed: decision.allowed,
        loading: Boolean(decision.pending),
        reason,
        needsBirthDate,
        askAdmin: Boolean(decision.askAdmin),
        href: decision.allowed ? actionHref(location, key, subject, hints) : null,
    };
}
