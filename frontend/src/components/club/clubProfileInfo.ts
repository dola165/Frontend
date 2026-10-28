import type { ClubProfile } from '../../features/clubs/profile/types';
import './club-tones.css';

export const toPhoneHref = (value?: string | null) => (value ? `tel:${value.replace(/\s+/g, '')}` : null);

export const toWhatsappHref = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.replace(/[^\d]/g, '');
    return normalized ? `https://wa.me/${normalized}` : null;
};

export const getDomainLabel = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.hostname.replace(/^www\./i, '');
    } catch {
        return value;
    }
};

export const summarizeClubTrust = (club: ClubProfile) => {
    if (!club.trustedByClubs.length) {
        return `${club.statusLabel || (club.isOfficial ? 'Verified' : 'Reviewing')}. No public club endorsements are published yet.`;
    }

    const preview = club.trustedByClubs.slice(0, 3).map((entry) => entry.clubName).join(', ');
    return club.trustedByClubs.length > 3
        ? `${club.statusLabel || (club.isOfficial ? 'Verified' : 'Reviewing')}. Backed by ${preview} and ${club.trustedByClubs.length - 3} more.`
        : `${club.statusLabel || (club.isOfficial ? 'Verified' : 'Reviewing')}. Backed by ${preview}.`;
};
