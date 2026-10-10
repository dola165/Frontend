import { currentProgramme, money, type ClubPresentation, type TrainingProgramme } from '../../clubs/presentation';
import { wt } from '../copy';

/** Published programmes that are running now, as the club profile lists them. */
export const publicProgrammes = (presentation?: ClubPresentation | null) =>
    presentation?.programmes.filter(programme => programme.published && currentProgramme(programme)) ?? [];

/** True when a programme's published age range includes this age; a programme without ages never claims to fit. */
export const fitsAge = (programme: TrainingProgramme, age: number) =>
    (programme.ageMin != null || programme.ageMax != null)
    && (programme.ageMin == null || age >= programme.ageMin) && (programme.ageMax == null || age <= programme.ageMax);

export function programmeAges(programme: TrainingProgramme) {
    const { ageMin: from, ageMax: to } = programme;
    if (from != null && to != null) return wt('Ages {from}–{to}', { from, to });
    if (from != null) return wt('Ages {from}+', { from });
    if (to != null) return wt('Up to age {to}', { to });
    return wt('Ask about ages');
}

const PERIOD: Record<TrainingProgramme['billingPeriod'], string> = { SESSION: 'session', MONTH: 'month', TERM: 'term', YEAR: 'year', ONE_OFF: 'one-off' };

export function programmeFee(programme: TrainingProgramme) {
    if (programme.priceType === 'FREE') return wt('Free');
    if (programme.priceType === 'VARIES') return wt('Price varies');
    if (programme.priceType === 'UNPUBLISHED' || programme.amount === null) return wt('Price not published');
    return `${money(programme.amount, programme.currency)} / ${wt(PERIOD[programme.billingPeriod])}`;
}

/** Where a parent asks a club about a place: the club's enquiry, for the chosen child and the programme that fits. */
export function enquiryPath(clubId: number, playerId?: number, programmeId?: number) {
    const params = new URLSearchParams({ tab: 'teams' });
    if (programmeId) params.set('programme', String(programmeId));
    params.set('enquire', '1');
    if (playerId) params.set('player', String(playerId));
    return `/clubs/${clubId}?${params}`;
}
