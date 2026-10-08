export const footballRoles = ['PLAYER', 'COACH', 'REFEREE', 'AGENT', 'CLUB_STAFF', 'PARENT', 'ORGANIZER', 'VENUE_MANAGER', 'FAN'] as const;
export type FootballRole = typeof footballRoles[number];
export interface RoleProfile {
    role: FootballRole;
    primary: boolean;
    published: boolean;
    headline?: string | null;
    specialties?: string | null;
    qualifications?: string | null;
    serviceArea?: string | null;
}

export const rolePresentation: Record<FootballRole, { label: string; description: string; focus: string; tone: string; destination?: string }> = {
    PLAYER: { label: 'Player', description: 'Your football interests and playing background.', focus: 'Playing interests', tone: 'var(--club-tone-green)' },
    COACH: { label: 'Coach', description: 'Your coaching approach, age groups and experience.', focus: 'Coaching focus', tone: 'var(--club-tone-blue)' },
    REFEREE: { label: 'Referee', description: 'The formats you officiate and your experience.', focus: 'Officiating formats', tone: 'var(--club-accent-orange)' },
    PARENT: { label: 'Parent / guardian', description: 'Manage your football identity alongside your family.', focus: 'Football interests', tone: 'var(--club-tone-cyan)', destination: '/parent' },
    AGENT: { label: 'Agent', description: 'Introduce your professional background and areas of focus.', focus: 'Representation focus', tone: 'var(--club-tone-blue)' },
    CLUB_STAFF: { label: 'Club / academy staff', description: 'Your work in club leadership, management and football development.', focus: 'Responsibilities and expertise', tone: 'var(--club-tone-blue)' },
    ORGANIZER: { label: 'Tournament organizer', description: 'The competitions and events you help organize.', focus: 'Competition focus', tone: 'var(--club-accent-orange)', destination: '/organizations/create' },
    VENUE_MANAGER: { label: 'Venue manager', description: 'Your experience managing pitches and football facilities.', focus: 'Facility experience', tone: 'var(--club-tone-green)', destination: '/organizations/create' },
    FAN: { label: 'Fan', description: 'Your interests and connection to football.', focus: 'Football interests', tone: 'var(--club-tone-cyan)' },
};

export const roleLabel = (role: string) => rolePresentation[role as FootballRole]?.label
    ?? role.toLowerCase().replaceAll('_', ' ').replace(/(^|\s)\S/g, letter => letter.toUpperCase());

export const professionalRoles = ['PLAYER', 'COACH', 'REFEREE', 'AGENT', 'CLUB_STAFF'] as const;
export const isProfessionalRole = (role: string) => (professionalRoles as readonly string[]).includes(role);
export type CareerKind = 'POSITION' | 'QUALIFICATION' | 'ACHIEVEMENT' | 'VOLUNTEERING';
export interface CareerEntry {
    id: number;
    role: string;
    kind: CareerKind;
    title: string;
    organization: string | null;
    startsOn: string;
    endsOn: string | null;
    description: string | null;
    published: boolean;
}
export interface ClubAppointment {
    clubId: number;
    clubName: string;
    logoUrl: string | null;
    role: string;
    title: string;
    coaching: boolean;
    memberSince: string | null;
    biography: string | null;
    qualifications: string | null;
    squads: string[];
}
export interface FootballProfile {
    roles: string[];
    appointments: ClubAppointment[];
    entries: CareerEntry[];
}
export const profileRoles = (profile: { role: string; footballProfile?: FootballProfile | null; roleProfiles?: RoleProfile[] }) =>
    profile.footballProfile?.roles ?? (profile.roleProfiles?.length
        ? profile.roleProfiles.map(item => item.role)
        : [profile.role === 'CLUB_ADMIN' ? 'CLUB_STAFF' : profile.role === 'SYSTEM_ADMIN' ? 'FAN' : profile.role]);
