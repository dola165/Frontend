import { visualColors } from '../../styles/visualColors';
import type { ClubJoinPolicy, ClubProfile, ClubRelationshipState } from './clubDirectoryTypes';

const CLUB_ACCENTS = [
    { backgroundColor: visualColors.clubDirectoryMappingsPaint2, color: visualColors.clubDirectoryMappingsPaint3, borderColor: visualColors.clubDirectoryMappingsPaint4 },
    { backgroundColor: visualColors.clubDirectoryMappingsPaint5, color: visualColors.clubDirectoryMappingsPaint6, borderColor: visualColors.clubDirectoryMappingsPaint7 },
    { backgroundColor: visualColors.clubDirectoryMappingsPaint8, color: visualColors.clubDirectoryMappingsPaint9, borderColor: visualColors.clubDirectoryMappingsPaint10 },
    { backgroundColor: visualColors.clubDirectoryMappingsPaint11, color: visualColors.clubDirectoryMappingsPaint12, borderColor: visualColors.clubDirectoryMappingsPaint13 },
    { backgroundColor: visualColors.clubDirectoryMappingsPaint14, color: visualColors.clubDirectoryMappingsPaint15, borderColor: visualColors.clubDirectoryMappingsPaint16 },
    { backgroundColor: visualColors.clubDirectoryMappingsPaint17, color: visualColors.clubDirectoryMappingsPaint18, borderColor: visualColors.clubDirectoryMappingsPaint19 }
] as const;

export const getClubLocation = (club: ClubProfile): string =>
    club.cityName || club.addressText?.split(',')[0] || 'Location pending';

export const getJoinPolicyClasses = (policy: ClubJoinPolicy): string => {
    switch (policy) {
        case 'OPEN_TRIAL':
            return 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]';
        case 'APPLICATION_REQUIRED':
            return 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]';
        case 'INVITE_ONLY':
            return 'bg-[color:var(--color-purple)]/10 text-[color:var(--color-purple)]';
    }
};

export const RELATIONSHIP_PRESENTATION: Partial<Record<ClubRelationshipState, {
    label: string;
    className: string;
    icon?: 'check' | 'clock';
}>> = {
    ACTIVE: { label: 'Member', className: 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]', icon: 'check' },
    APPLIED: { label: 'Pending', className: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]', icon: 'clock' },
    INVITED: { label: 'Invited', className: 'bg-[color:var(--color-info)]/10 text-[color:var(--color-info)]' },
    TRIALIST: { label: 'Trialist', className: 'bg-[color:var(--color-purple)]/10 text-[color:var(--color-purple)]' }
};

export const getClubAccentStyle = (club: Pick<ClubProfile, 'id' | 'name'>) => {
    const seed = `${club.id}:${club.name}`;
    const hash = Array.from(seed).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
    return CLUB_ACCENTS[hash % CLUB_ACCENTS.length];
};
