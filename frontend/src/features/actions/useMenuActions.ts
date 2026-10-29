import { FolderKanban, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import { projectsPath } from '../projects/projectWords';
import { useMyProjects } from '../projects/useProjects';
import { ownClub } from '../pages/create/entry';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ACTIONS, type ActionKey } from './registry';
import { useAction, type ActionState } from './useAction';
import { useResultsWaiting } from './useResultsWaiting';

/** One line of the "+" menu: a rule-checked action, or New project for someone who may start one. */
export interface MenuAction { key: ActionKey | 'start_project'; href: string; label: [english: string, georgian: string]; icon: LucideIcon; color?: string; hint?: string; waiting?: boolean }

/**
 * What the person may start from anywhere, in the order that fits them: a score that is owed first, then a coach's
 * match and staff, or a parent's child and join code, and starting a club last. Only what the rule-checker allows, and
 * New project (step 4) for anyone on a club's staff, at the club where they may start one.
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
    const staff = ['club.member', 'club.office', 'club.projects'].some(id => hasNavigationCapability(user?.navigationCapabilities, id));
    const projectsHere = useMyProjects(staff).data?.find(entry => entry.canStart);
    const coach = arrange.allowed;
    const item = (key: ActionKey, state: ActionState, extra: Partial<MenuAction> = {}): MenuAction[] => state.allowed && state.href
        ? [{ key, href: state.href, label: ACTIONS[key].label, icon: ACTIONS[key].icon, color: ACTIONS[key].color, ...extra }] : [];
    const project: MenuAction[] = projectsHere ? [{ key: 'start_project', href: projectsPath(projectsHere.club.id, 'projects', { new: '1' }),
        label: ['New project', 'ახალი პროექტი'], icon: FolderKanban }] : [];
    const owed = newest ? item('report_score', score, {
        waiting: true,
        hint: [newest.squadName && newest.opponentName ? `${newest.squadName} v ${newest.opponentName}` : newest.title, waiting.length > 1 ? copy(`+${waiting.length - 1} more`, `+${waiting.length - 1} კიდევ`) : null].filter(Boolean).join(' · '),
    }) : [];
    const coaching = [...item('arrange_match', arrange), ...(club ? item('invite_staff', invite) : []), ...project];
    const family = [...item('add_child', child), ...item('join_squad', join)];
    return [...owed, ...(coach && !parent ? [...coaching, ...family] : [...family, ...coaching]), ...item('start_club', start)];
}
