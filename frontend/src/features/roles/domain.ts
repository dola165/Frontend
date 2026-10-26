export const footballRoles = ['PLAYER', 'COACH', 'REFEREE', 'AGENT', 'CLUB_STAFF', 'PARENT', 'ORGANIZER', 'VENUE_MANAGER', 'FAN'] as const;
export type FootballRole = typeof footballRoles[number];
/** Sections only a link adds (a club appointment, an organisation): someone who has one keeps or removes it, nobody picks it. */
export const linkedRoles: readonly FootballRole[] = ['CLUB_STAFF', 'ORGANIZER'];
/** Whether a role is offered as a tile: every role anyone may pick, plus the linked ones this person already holds. */
export const isOffered = (role: string, held: readonly string[]) => !(linkedRoles as readonly string[]).includes(role) || held.includes(role);
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

const georgianRoles: Record<FootballRole, [label: string, description: string]> = {
    PLAYER: ['მოთამაშე', 'თქვენი საფეხბურთო ინტერესები და სათამაშო გამოცდილება.'],
    COACH: ['მწვრთნელი', 'თქვენი სამწვრთნელო მიდგომა, ასაკობრივი ჯგუფები და გამოცდილება.'],
    REFEREE: ['მსაჯი', 'მატჩების ფორმატები და თქვენი სამსაჯო გამოცდილება.'],
    AGENT: ['აგენტი', 'თქვენი პროფესიული გამოცდილება და საქმიანობის მიმართულებები.'],
    CLUB_STAFF: ['კლუბის / აკადემიის თანამშრომელი', 'თქვენი საქმიანობა კლუბის ხელმძღვანელობაში, მართვასა და ფეხბურთის განვითარებაში.'],
    PARENT: ['მშობელი / მეურვე', 'თქვენი საფეხბურთო პროფილი და ოჯახი.'],
    ORGANIZER: ['ტურნირის ორგანიზატორი', 'შეჯიბრებები და ღონისძიებები, რომელთა ორგანიზებაშიც მონაწილეობთ.'],
    VENUE_MANAGER: ['მოედნის მმართველი', 'თქვენი გამოცდილება მოედნებისა და საფეხბურთო ინფრასტრუქტურის მართვაში.'],
    FAN: ['გულშემატკივარი', 'თქვენი ინტერესები და კავშირი ფეხბურთთან.'],
};

export function roleCopy(role: string, copy: (english: string, georgian: string) => string) {
    const presentation = rolePresentation[role as FootballRole];
    const ka = georgianRoles[role as FootballRole];
    return { label: ka ? copy(presentation.label, ka[0]) : roleLabel(role), description: ka ? copy(presentation.description, ka[1]) : undefined };
}

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
