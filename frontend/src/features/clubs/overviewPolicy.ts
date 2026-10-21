import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import type { ScheduleEventOccurrence } from '../schedule/api';
import { currentProgramme, type TrainingProgramme } from './presentation';

export type OverviewLead = 'family' | 'training' | 'teams' | 'club';
/**
 * What a club's front page leads with for one reader, from the links someone confirmed for them (a family at this club,
 * a place at this club, a child anywhere, a squad or club they work for). Relevance only: it never decides access.
 */
export function overviewLead(clubId: number, caps?: NavigationCapabilities): OverviewLead {
    const contexts = caps?.workspaces ?? [];
    if (contexts.some(w => w.id === 'club.family' && w.context.type === 'club' && w.context.id === clubId)) return 'family';
    if (contexts.some(w => w.context.type === 'club' && w.context.id === clubId)) return 'club';
    if (contexts.some(w => w.id === 'parent.hub' || w.id === 'club.family')) return 'training';
    if (contexts.some(w => ['club.workspace', 'club.operations', 'club.agent', 'squad.workspace'].includes(w.id))) return 'teams';
    return contexts.some(w => w.id === 'club.player') ? 'training' : 'club';
}
export const overviewProgrammes = (items: TrainingProgramme[] = [], today?: string) => items.filter(p => p.published && currentProgramme(p, today));
export function overviewFixtures(items: ScheduleEventOccurrence[], now = Date.now()) {
    return items.filter(e => e.publicNow === true && ['MATCH', 'FRIENDLY'].includes(e.eventType)
        && e.status !== 'COMPLETED' && e.status !== 'CANCELLED' && e.challengeStatus !== 'REJECTED'
        && Number.isFinite(Date.parse(e.startsAt)) && Date.parse(e.endsAt || e.startsAt) >= now)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 3);
}
