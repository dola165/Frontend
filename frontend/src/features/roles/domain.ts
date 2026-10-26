export type FootballRole = 'PLAYER' | 'COACH' | 'REFEREE' | 'AGENT' | 'CLUB_STAFF' | 'PARENT' | 'ORGANIZER' | 'VENUE_MANAGER' | 'FAN';
export interface RoleProfile {
    role: FootballRole;
    primary: boolean;
    published: boolean;
    headline?: string | null;
    specialties?: string | null;
    qualifications?: string | null;
    serviceArea?: string | null;
}

/** A role's name and one line about it, for profiles from before F6 and the career form. */
const rolePresentation: Record<FootballRole, { label: string; description: string }> = {
    PLAYER: { label: 'Player', description: 'Your football interests and playing background.' },
    COACH: { label: 'Coach', description: 'Your coaching approach, age groups and experience.' },
    REFEREE: { label: 'Referee', description: 'The formats you officiate and your experience.' },
    PARENT: { label: 'Parent / guardian', description: 'Manage your football identity alongside your family.' },
    AGENT: { label: 'Agent', description: 'Introduce your professional background and areas of focus.' },
    CLUB_STAFF: { label: 'Club / academy staff', description: 'Your work in club leadership, management and football development.' },
    ORGANIZER: { label: 'Tournament organizer', description: 'The competitions and events you help organize.' },
    VENUE_MANAGER: { label: 'Venue manager', description: 'Your experience managing pitches and football facilities.' },
    FAN: { label: 'Fan', description: 'Your interests and connection to football.' },
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
