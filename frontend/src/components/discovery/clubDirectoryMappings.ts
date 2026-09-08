import type { ClubJoinPolicy, ClubProfile, ClubRelationshipState } from './clubDirectoryTypes';

const CLUB_ACCENTS = [
    { backgroundColor: '#052e16', color: '#86efac', borderColor: '#16a34a' },
    { backgroundColor: '#172554', color: '#93c5fd', borderColor: '#2563eb' },
    { backgroundColor: '#431407', color: '#fdba74', borderColor: '#ea580c' },
    { backgroundColor: '#3b0764', color: '#d8b4fe', borderColor: '#9333ea' },
    { backgroundColor: '#500724', color: '#f9a8d4', borderColor: '#db2777' },
    { backgroundColor: '#1e293b', color: '#cbd5e1', borderColor: '#64748b' }
] as const;

export const getClubLocation = (club: ClubProfile): string =>
    club.cityName || club.addressText?.split(',')[0] || 'Location pending';

export const getJoinPolicyClasses = (policy: ClubJoinPolicy): string => {
    switch (policy) {
        case 'OPEN_TRIAL':
            return 'bg-emerald-500/10 text-emerald-400';
        case 'APPLICATION_REQUIRED':
            return 'bg-amber-500/10 text-amber-400';
        case 'INVITE_ONLY':
            return 'bg-violet-500/10 text-violet-400';
    }
};

export const RELATIONSHIP_PRESENTATION: Partial<Record<ClubRelationshipState, {
    label: string;
    className: string;
    icon?: 'check' | 'clock';
}>> = {
    ACTIVE: { label: 'Member', className: 'bg-emerald-500/10 text-emerald-400', icon: 'check' },
    APPLIED: { label: 'Pending', className: 'bg-amber-500/10 text-amber-400', icon: 'clock' },
    INVITED: { label: 'Invited', className: 'bg-sky-500/10 text-sky-400' },
    TRIALIST: { label: 'Trialist', className: 'bg-violet-500/10 text-violet-400' }
};

export const getClubAccentStyle = (club: Pick<ClubProfile, 'id' | 'name'>) => {
    const seed = `${club.id}:${club.name}`;
    const hash = Array.from(seed).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
    return CLUB_ACCENTS[hash % CLUB_ACCENTS.length];
};
