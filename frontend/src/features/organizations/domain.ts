import type { OrganizationKind } from '../tournaments/domain';

export interface OrganizationProfile {
    contentClassification?: string;
    contentRevision?: number;
    promotionBlocked?: boolean;
    capabilities?: import('./activities/api').OrganizationCapabilities;
    id: number;
    displayName: string;
    description: string | null;
    kinds: OrganizationKind[];
    profileKind: OrganizationKind;
    clubId: number | null;
    verificationStatus: string;
    published: boolean;
    website: string | null;
    publicEmail: string | null;
    publicPhone: string | null;
    addressText: string | null;
    focus: string | null;
    canEdit: boolean;
    canCreateTournament: boolean;
}
export type OrganizationProfileDraft = Pick<OrganizationProfile,
    'published' | 'displayName' | 'description' | 'website' | 'publicEmail' | 'publicPhone' | 'addressText' | 'focus'>;

export const organizationPresentation = (kind: OrganizationKind) => {
    switch (kind) {
        case 'VENUE': return { label: 'Stadium & venue', focus: 'Facilities and playing spaces', contact: 'Visit or contact the venue', accent: '#16a34a' };
        case 'TOURNAMENT_ORGANIZER': return { label: 'Tournament organizer', focus: 'Competitions and age groups', contact: 'Contact the organizing team', accent: '#d97706' };
        case 'MEDIA': return { label: 'Media organization', focus: 'Coverage and interests', contact: 'Contact the team', accent: '#0284c7' };
        case 'HEALTHCARE': return { label: 'Healthcare organization', focus: 'Services and specialties', contact: 'Contact the team', accent: '#0891b2' };
        case 'SPONSOR': return { label: 'Sponsor', focus: 'Sponsorship focus', contact: 'Partnership enquiries', accent: '#9333ea' };
        default: return { label: 'Organization', focus: 'What we do', contact: 'Public contact', accent: '#0284c7' };
    }
};
