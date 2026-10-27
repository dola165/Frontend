import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import { ownClub } from '../pages/create/entry';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ActionKey } from './registry';
import { useAction, type ActionState } from './useAction';
import { useResultsWaiting } from './useResultsWaiting';

export interface MenuAction { key: ActionKey; href: string; hint?: string; waiting?: boolean }

/**
 * What the person may start from anywhere, in the order that fits them: a score that is owed first, then a coach's
 * match and staff, or a parent's child and join code, and starting a club last. Only what the rule-checker allows.
 */
export function useMenuActions(): MenuAction[] {
    const { user } = useAuth();
    const copy = useJourneyCopy();
    const club = ownClub(user?.navigationCapabilities);
    const waiting = useResultsWaiting();
    const newest = waiting?.[0];
    const score = useAction('report_score', newest ? { kind: 'match', source: newest.kind, id: newest.id, squadId: newest.squadId } : { kind: 'me' });
    const arrange = useAction('arrange_match');
    const child = useAction('add_child');
    const join = useAction('join_squad');
    const invite = useAction('invite_staff', club ? { kind: 'club', id: club.id } : { kind: 'me' }, { fallback: false });
    const start = useAction('start_club');
    const parent = hasNavigationCapability(user?.navigationCapabilities, 'parent.hub');
    const coach = arrange.allowed;
    const item = (key: ActionKey, state: ActionState, extra: Partial<MenuAction> = {}): MenuAction[] => state.allowed && state.href ? [{ key, href: state.href, ...extra }] : [];
    const owed = newest ? item('report_score', score, {
        waiting: true,
        hint: [newest.squadName && newest.opponentName ? `${newest.squadName} v ${newest.opponentName}` : newest.title, waiting.length > 1 ? copy(`+${waiting.length - 1} more`, `+${waiting.length - 1} კიდევ`) : null].filter(Boolean).join(' · '),
    }) : [];
    const coaching = [...item('arrange_match', arrange), ...(club ? item('invite_staff', invite) : [])];
    const family = [...item('add_child', child), ...item('join_squad', join)];
    return [...owed, ...(coach && !parent ? [...coaching, ...family] : [...family, ...coaching]), ...item('start_club', start)];
}
