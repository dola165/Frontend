import type { Opportunity } from '../../admissions/types';
import type { useWorldCopy } from '../copy';

/** Who a place to train is for: the birth years, boys or girls, and whether beginners are welcome. */
export const groupFor = (group: Opportunity, t: ReturnType<typeof useWorldCopy>) =>
    [t('Born {from}–{to}', { from: group.birthYearFrom, to: group.birthYearTo }), group.gender === 'ANY' ? null : group.gender === 'MALE' ? t('Boys') : t('Girls'), group.beginnerWelcome ? t('Beginners welcome') : null];

/** Whether a place to train has room: open (green), a waiting list (amber), or neither. */
export const groupTone = (group: Opportunity) => group.availability === 'PLACES_AVAILABLE' || group.availability === 'APPLICATIONS_OPEN' ? 'accent' : group.availability === 'WAITLIST' ? 'warning' : 'neutral';
