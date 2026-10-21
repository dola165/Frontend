import type { Bootstrap } from '../../clubOperations/api';
import type { RoleView, RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { focusableViews } from '../../clubOperations/workspaceStructure';
import { upcoming, type CoachSquad } from './useCoachData';
import type { SquadSession } from '../../squadCommunication/api';

export interface CoachTrainingContext {
    clubId: number; actorId: number; state: 'loading' | 'unavailable' | 'ready';
    next: { squadId: number; squadName: string; session: SquadSession } | null;
}

/** Reuse the coach's current squad reads. Failed/cached or missing reads are never an empty timetable. */
export function coachTrainingContext(clubId: number, actorId: number, assigned: RolesWorkspace['squads'], loaded: CoachSquad[] | null, now: number): CoachTrainingContext {
    if (!loaded) return { clubId, actorId, state: 'loading', next: null };
    const reads = assigned.map(squad => ({ squad, read: loaded.find(item => item.id === squad.id) }));
    const candidates = reads.flatMap(({ squad, read }) => !read || read.failed.includes('sessions') ? [] : upcoming(read, now)
        .filter(session => (session.event_type ?? 'TRAINING') === 'TRAINING' && Number.isSafeInteger(session.id) && session.id > 0)
        .map(session => ({ squadId: squad.id, squadName: squad.name, session })));
    candidates.sort((a, b) => new Date(a.session.starts_at).getTime() - new Date(b.session.starts_at).getTime());
    return { clubId, actorId, state: reads.some(({ read }) => !read || read.failed.includes('sessions')) ? 'unavailable' : 'ready', next: candidates[0] ?? null };
}

/** Squads named in some squad-level responsibilities: by default all of a person's own, or the ones switched on in Responsibilities. */
export function mySquadIds(views: RoleView[]) {
    return [...new Set(focusableViews(views).filter(view => !view.clubWide).flatMap(view => view.squadIds))];
}

export function personName(roles: RolesWorkspace, boot: Bootstrap | null, id: number | null) {
    if (id === null) return null;
    return roles.people.find(p => p.id === id)?.name ?? boot?.people.find(p => p.id === id)?.name ?? null;
}

/** Where a responsibility applies: the whole club, its squads, or nowhere yet (as `null`). */
export const viewSquads = (view: RoleView, roles: RolesWorkspace) => view.clubWide
    ? 'club' as const
    : roles.requestSquads.filter(s => view.squadIds.includes(s.id)).map(s => s.name).join(', ') || null;
