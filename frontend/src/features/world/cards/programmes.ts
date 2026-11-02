import { currentProgramme, money, type ClubPresentation, type TrainingProgramme } from '../../clubs/presentation';
import type { Participant } from '../../admissions/types';
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

/** The same ages as the birth years a parent reads ("Born 2018–2020"), never "Ages 6–8" (step 5). */
export function programmeBorn(programme: TrainingProgramme, year = new Date().getFullYear()) {
    const { ageMin: min, ageMax: max } = programme;
    if (min != null && max != null) return min === max ? wt('Born {year}', { year: year - min }) : wt('Born {from}–{to}', { from: year - max, to: year - min });
    if (min != null) return wt('Born {year} or earlier', { year: year - min });
    if (max != null) return wt('Born {year} or later', { year: year - max });
    return wt('Ask about ages');
}

/** An age group's code ("U9") as the one birth year it stands for this year ("Born 2018"), as joining groups count it. */
export function bornOfCode(code?: string | null, year = new Date().getFullYear()) {
    const under = /^U(\d{1,2})$/i.exec(code ?? '');
    return under ? wt('Born {year}', { year: year - Number(under[1]) + 1 }) : null;
}

const PERIOD: Record<TrainingProgramme['billingPeriod'], string> = { SESSION: 'session', MONTH: 'month', TERM: 'term', YEAR: 'year', ONE_OFF: 'one-off' };

export function programmeFee(programme: TrainingProgramme) {
    if (programme.priceType === 'FREE') return wt('Free');
    if (programme.priceType === 'VARIES') return wt('Price varies');
    if (programme.priceType === 'UNPUBLISHED' || programme.amount === null) return wt('Price not published');
    return `${money(programme.amount, programme.currency)} / ${wt(PERIOD[programme.billingPeriod])}`;
}

/** The programmes that fit a child's age, if any; otherwise none. */
export function fittingProgrammes(presentation: ClubPresentation | null | undefined, child?: Participant) {
    const born = child?.dateOfBirth?.slice(0, 4);
    const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Tbilisi' }).format(new Date()));
    const age = born && /^\d{4}$/.test(born) ? year - Number(born) : null;
    return age == null ? [] : publicProgrammes(presentation).filter(programme => fitsAge(programme, age));
}
