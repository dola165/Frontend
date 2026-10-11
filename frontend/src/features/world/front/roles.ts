import { isGeorgian, wt } from '../copy';
import type { WorldAudience } from './audience';
import type { FieldId } from './fields';

/** Who the person is on World's front page. It decides the fields they are offered and the page they start with. */
export type WorldRole = 'head-coach' | 'assistant-coach' | 'goalkeeper-coach' | 'fitness-coach' | 'analyst' | 'team-manager' | 'academy-director'
    | 'club-admin' | 'specialist' | 'parent' | 'player' | 'referee' | 'fan' | 'agent' | 'organiser' | 'venue-operator';

/** What sits beside the map, and the fields that follow below it, in order, for one role. */
export interface OverviewLayout { role: WorldRole; side: FieldId; fields: FieldId[] }

export type RoleGroup = 'Coaching staff' | 'At a club' | 'Families and players' | 'Around the game';
export const ROLE_GROUPS: RoleGroup[] = ['Coaching staff', 'At a club', 'Families and players', 'Around the game'];

export interface RoleInfo {
    id: WorldRole; label: string; group: RoleGroup;
    /** The page this role starts with: the field beside the map, then five or so below. */ side: FieldId; fields: FieldId[];
    /** More fields that suit the role, offered first when customising. */ extra: FieldId[];
}

export const ROLES: RoleInfo[] = [
    { id: 'head-coach', label: 'Head coach', group: 'Coaching staff', side: 'nextOpponent', fields: ['invitations', 'myCompetitions', 'opponentsForYou', 'freePitches', 'refereesForYou', 'fromClubs'], extra: ['squadFixtures', 'competitionsForYou', 'competitionResults', 'watchOpponents', 'matchLoad', 'ageTrials', 'matches', 'results', 'events', 'referees', 'venues', 'clubs', 'coachingJobs', 'arrangements'] },
    { id: 'assistant-coach', label: 'Assistant coach', group: 'Coaching staff', side: 'nextOpponent', fields: ['squadFixtures', 'watchOpponents', 'competitionResults', 'freePitches', 'coachingJobs', 'fromClubs'], extra: ['invitations', 'myCompetitions', 'opponentsForYou', 'matchLoad', 'ageTrials', 'results', 'specialists', 'indoorPitches'] },
    { id: 'goalkeeper-coach', label: 'Goalkeeper coach', group: 'Coaching staff', side: 'nextOpponent', fields: ['indoorPitches', 'matchLoad', 'ageTrials', 'coachingJobs', 'fromClubs'], extra: ['freePitches', 'squadFixtures', 'competitionResults', 'watchOpponents', 'specialists', 'academies'] },
    { id: 'fitness-coach', label: 'Fitness coach', group: 'Coaching staff', side: 'matchLoad', fields: ['freePitches', 'indoorPitches', 'squadFixtures', 'specialists', 'fromClubs'], extra: ['staffJobs', 'coachingJobs', 'nextOpponent', 'venues', 'academies', 'groups'] },
    { id: 'analyst', label: 'Analyst or scout', group: 'Coaching staff', side: 'nextOpponent', fields: ['watchOpponents', 'competitionResults', 'myCompetitions', 'ageTrials', 'liveCompetitions', 'fromClubs'], extra: ['results', 'events', 'academies', 'clubs', 'staffJobs', 'openClubs', 'squadFixtures'] },
    { id: 'team-manager', label: 'Team manager', group: 'Coaching staff', side: 'invitations', fields: ['refereesForYou', 'freePitches', 'squadFixtures', 'arrangements', 'competitionsForYou', 'fromClubs'], extra: ['opponentsForYou', 'myCompetitions', 'nextOpponent', 'matchLoad', 'referees', 'venues', 'refereeNeeded', 'matches'] },
    { id: 'academy-director', label: 'Academy director', group: 'Coaching staff', side: 'myCompetitions', fields: ['competitionsForYou', 'competitionResults', 'coachingJobs', 'ageTrials', 'academies', 'fromClubs'], extra: ['squadFixtures', 'matchLoad', 'invitations', 'clubs', 'specialists', 'staffJobs', 'liveCompetitions', 'groups', 'results'] },
    { id: 'club-admin', label: 'Club administrator', group: 'At a club', side: 'events', fields: ['competitions', 'venues', 'jobs', 'clubs', 'campaigns'], extra: ['staffJobs', 'coachingJobs', 'referees', 'specialists', 'academies', 'volunteering'] },
    { id: 'specialist', label: 'Physio or specialist', group: 'At a club', side: 'staffJobs', fields: ['specialists', 'clubs', 'academies', 'events'], extra: ['people', 'jobs', 'liveCompetitions'] },
    { id: 'parent', label: 'Parent', group: 'Families and players', side: 'groups', fields: ['trials', 'openClubs', 'academies', 'events', 'volunteering'], extra: ['clubs', 'venues', 'liveCompetitions', 'results', 'campaigns'] },
    { id: 'player', label: 'Player', group: 'Families and players', side: 'trials', fields: ['openClubs', 'events', 'matches', 'venues', 'competitions'], extra: ['groups', 'results', 'liveCompetitions', 'clubs', 'people'] },
    { id: 'referee', label: 'Referee', group: 'Around the game', side: 'refereeNeeded', fields: ['events', 'liveCompetitions', 'referees', 'competitions'], extra: ['matches', 'results', 'venues', 'clubs'] },
    { id: 'fan', label: 'Fan or supporter', group: 'Around the game', side: 'events', fields: ['results', 'liveCompetitions', 'clubs', 'volunteering', 'campaigns'], extra: ['academies', 'competitions', 'jobs'] },
    { id: 'agent', label: 'Agent', group: 'Around the game', side: 'trials', fields: ['results', 'academies', 'people', 'liveCompetitions'], extra: ['events', 'openClubs', 'clubs', 'competitions'] },
    { id: 'organiser', label: 'Competition organiser', group: 'Around the game', side: 'competitions', fields: ['matches', 'venues', 'referees', 'clubs', 'academies'], extra: ['liveCompetitions', 'results', 'events', 'refereeNeeded', 'volunteering'] },
    { id: 'venue-operator', label: 'Pitch or venue operator', group: 'Around the game', side: 'matches', fields: ['events', 'competitions', 'venues', 'clubs'], extra: ['arrangements', 'liveCompetitions', 'academies', 'groups'] },
];
export const roleInfo = (id: WorldRole) => ROLES.find(role => role.id === id) ?? ROLES[0];

/** "a head coach", "an academy director": the role in a sentence, in the current language (Georgian has no article). */
export const aRole = (id: WorldRole) => { const label = wt(roleInfo(id).label).toLowerCase(); return isGeorgian() ? label : `${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label}`; };

/** A role's own page. */
export const roleLayout = (id: WorldRole): OverviewLayout => { const role = roleInfo(id); return { role: role.id, side: role.side, fields: role.fields }; };

/** The fields a role is offered: its page and its extras, before the rest of the catalog. */
export const offeredFor = (id: WorldRole): FieldId[] => { const role = roleInfo(id); return [role.side, ...role.fields, ...role.extra]; };

/** Until the person chooses, the role follows their relationships: coaching, a chosen child, playing for a club. */
export function defaultRole(audience: WorldAudience, clubRole?: string | null): WorldRole {
    if (audience === 'coach') return 'head-coach';
    if (audience === 'parent') return 'parent';
    return clubRole === 'PLAYER' ? 'player' : 'fan';
}
