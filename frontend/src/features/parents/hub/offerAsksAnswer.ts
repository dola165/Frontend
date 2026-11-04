import { answerAsk } from './familyAsks';

export interface OfferAsksAnswer { photos: boolean; trips: boolean; note: string }
export const NO_OFFER_ASKS: OfferAsksAnswer = { photos: false, trips: false, note: '' };

/** After the place is accepted. Best effort: a failure here takes nothing away, and Parent Hub still asks. */
export function sendOfferAsks(child: number, clubId: number | null, answer: OfferAsksAnswer) {
    if (!clubId) return;
    const ask = (kind: 'PHOTOS' | 'TRIPS' | 'MEDICAL', note?: string) =>
        answerAsk(child, { clubId, kind, recordId: null, revision: null }, true, note).catch(() => undefined);
    if (answer.photos) void ask('PHOTOS');
    if (answer.trips) void ask('TRIPS');
    if (answer.note.trim()) void ask('MEDICAL', answer.note.trim());
}
