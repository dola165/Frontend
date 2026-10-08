import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import type { ScheduleEventOccurrence } from '../schedule/api';
import { currentProgramme, type TrainingProgramme } from './presentation';

export type OverviewLead = 'family' | 'training' | 'teams' | 'club';
/** Relevance changes presentation only. It never supplies an authorization decision. */
export function overviewLead(clubId: number, role?: string, caps?: NavigationCapabilities): OverviewLead {
    const contexts = caps?.workspaces ?? [];
    if (contexts.some(w => w.id === 'club.family' && w.context.type === 'club' && w.context.id === clubId)) return 'family';
    if (contexts.some(w => w.context.type === 'club' && w.context.id === clubId)) return 'club';
    if (role === 'PARENT' || contexts.some(w => w.id === 'parent.hub')) return 'training';
    if (role === 'COACH' || contexts.some(w => ['club.workspace', 'club.operations', 'club.agent'].includes(w.id))) return 'teams';
    return role === 'PLAYER' ? 'training' : 'club';
}
/** Only the default destination changes. Explicit links always win. */
export function clubLandingTab(clubId: number, role?: string, caps?: NavigationCapabilities): 'overview' | 'posts' {
    const contexts = caps?.workspaces ?? [];
    if (contexts.some(w => w.context.type === 'club' && w.context.id === clubId)) return 'overview';
    if (role && role !== 'FAN') return 'overview';
    if (contexts.some(w => ['parent.hub', 'referee.workspace', 'agent.hub', 'club.workspace', 'club.operations', 'club.agent', 'organization.workspace', 'venue.workspace', 'tournament.workspace', 'squad.workspace'].includes(w.id))) return 'overview';
    return 'posts';
}
export const overviewProgrammes = (items: TrainingProgramme[] = [], today?: string) => items.filter(p => p.published && currentProgramme(p, today));
export function overviewFixtures(items: ScheduleEventOccurrence[], now = Date.now()) {
    return items.filter(e => e.publicNow === true && ['MATCH', 'FRIENDLY'].includes(e.eventType)
        && e.status !== 'COMPLETED' && e.status !== 'CANCELLED' && e.challengeStatus !== 'REJECTED'
        && Number.isFinite(Date.parse(e.startsAt)) && Date.parse(e.endsAt || e.startsAt) >= now)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 3);
}
