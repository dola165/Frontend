import type { BadgeTone } from '../../../design/primitives';

const tones: Record<string, BadgeTone> = {
    PENDING: 'warning', SHORTLISTED: 'info', OFFERED: 'info', ACCEPTED: 'accent',
    DECLINED: 'neutral', REJECTED: 'neutral', CANCELLED: 'neutral', EXPIRED: 'neutral', OFFER_DECLINED: 'neutral', OFFER_CANCELLED: 'neutral',
};

/** The badge colour for an application or tryout outcome; the badge text always says the outcome too. */
export const outcomeTone = (status: string): BadgeTone => tones[status] ?? 'neutral';
