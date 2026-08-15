import type { ClubProfile } from '../../pages/ClubProfilePage';

export interface ClubProfileActionLink {
    href: string;
    label: string;
    toneClassName: string;
}

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

export const buildClubProfileLinks = (club: ClubProfile): ClubProfileActionLink[] => {
    const links: ClubProfileActionLink[] = [];
    const seen = new Set<string>();

    const pushLink = (href: string | null | undefined, label: string, toneClassName: string) => {
        if (!href || seen.has(href)) return;
        seen.add(href);
        links.push({ href, label, toneClassName });
    };

    pushLink(toWhatsappHref(club.whatsappNumber), 'WhatsApp', 'club-tone-green');
    pushLink(club.facebookMessengerUrl, 'Facebook', 'club-tone-purple');
    pushLink(club.websiteUrl, 'Website', 'club-tone-blue');
    pushLink(club.instagramUrl, 'Instagram', 'club-tone-cyan');

    club.opportunities
        .filter((opportunity) => Boolean(opportunity.externalLink))
        .slice(0, 4)
        .forEach((opportunity) => {
            const label =
                opportunity.type === 'FUNDRAISING'
                    ? 'Fundraising'
                    : opportunity.type === 'JOB'
                        ? 'Jobs'
                        : opportunity.type === 'VOLUNTEER'
                            ? 'Volunteer'
                            : null;
            if (label) {
                pushLink(opportunity.externalLink, label, 'club-tone-blue');
            }
        });

    return links;
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
