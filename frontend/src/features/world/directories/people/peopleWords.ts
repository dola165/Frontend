import { Activity, Apple, Brain, Camera, Dumbbell, Scale, Stethoscope, Video, type LucideIcon } from 'lucide-react';
import type { OpenTo, StatedLicence } from '../../api';
import { wt } from '../../copy';
import type { PersonKind } from './personData';

/** The services specialists offer, by the words they describe themselves with. */
export const SERVICES: { value: string; label: string; icon: LucideIcon; match: RegExp }[] = [
    { value: 'Physiotherapist', label: 'Physio', icon: Activity, match: /physio/i },
    { value: 'Sports psychologist', label: 'Psychology', icon: Brain, match: /psycholog/i },
    { value: 'Sports nutritionist', label: 'Nutrition', icon: Apple, match: /nutrition/i },
    { value: 'Strength & conditioning coach', label: 'Strength', icon: Dumbbell, match: /strength|conditioning|fitness/i },
    { value: 'Video analyst', label: 'Video analysis', icon: Video, match: /video|analys/i },
    { value: 'Team doctor', label: 'Medical', icon: Stethoscope, match: /doctor|medical/i },
    { value: 'Football photographer', label: 'Photography', icon: Camera, match: /photograph/i },
    { value: 'Sports lawyer', label: 'Legal', icon: Scale, match: /lawyer|legal/i },
];
export const serviceOf = (text: string | null | undefined) => SERVICES.find(service => service.match.test(text ?? ''));

const LICENCE_NAME: Record<StatedLicence, string> = { PRO: 'UEFA Pro licence', A: 'UEFA A licence', B: 'UEFA B licence', C: 'UEFA C licence', GK: 'Goalkeeper licence' };
export const licenceName = (licence: StatedLicence) => wt(LICENCE_NAME[licence]);

/** A referee's level from what they state ("GFF Regional referee · Category 1" → "REG 1"). */
export function refereeLevel(qualifications: string | null | undefined) {
    const text = qualifications ?? '';
    if (/fifa assistant/i.test(text)) return 'FIFA AR';
    if (/fifa/i.test(text)) return 'FIFA';
    if (/national/i.test(text)) return 'NAT';
    const category = /category\s*(\d)/i.exec(text)?.[1];
    if (/regional/i.test(text)) return category ? `REG ${category}` : 'REG';
    if (/youth/i.test(text)) return 'YTH';
    return null;
}

/** What someone is open to, in each view's own words (a coach's SERVICES is private training; a specialist's, clients). */
export const OPEN_TO: Record<PersonKind, Partial<Record<OpenTo, string>>> = {
    staff: { WORK: 'Open to work', SERVICES: 'Private training', VOLUNTEER: 'Volunteers' },
    specialist: { SERVICES: 'Takes clients', WORK: 'Open to work', VOLUNTEER: 'Volunteers' },
    player: { CLUB: 'Looking for a club', COACHING: 'Looking for a coach' },
};
/** The "Open to" filter of one view: its words, in the order they are offered. */
export const openToOptions = (kind: PersonKind) => Object.entries(OPEN_TO[kind]).map(([value, label]) => ({ value, label }));
/** The words for what someone is open to, translated, in the view's order. */
export const openToWords = (kind: PersonKind, open: OpenTo[] | undefined) =>
    Object.entries(OPEN_TO[kind]).filter(([value]) => open?.includes(value as OpenTo)).map(([, label]) => wt(label));
