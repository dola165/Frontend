import { apiClient } from '../../../api/axiosConfig';

export type AskKind = 'PHOTOS' | 'TRIPS' | 'MEDICAL' | 'PARTICIPATION' | 'TRIP' | 'CARE' | 'COLLECTION' | 'PERMISSION';

/** One line of a family's asks: the server says what is asked and what was answered, by whom and when. */
export interface Ask {
    key: string;
    kind: AskKind;
    clubId: number;
    clubName: string;
    crestUrl: string | null;
    recordId: number | null;
    revision: number | null;
    title: string | null;
    wording: string | null;
    purpose: string | null;
    answer: 'WAITING' | 'YES' | 'NO';
    answeredBy: string | null;
    answeredAt: string | null;
    canAnswer: boolean;
    note: string | null;
}

export const fetchAsks = (child: number, signal?: AbortSignal) =>
    apiClient.get<Ask[]>(`/family/children/${child}/asks`, { signal }).then(r => r.data);

export const answerAsk = (child: number, ask: Pick<Ask, 'clubId' | 'kind' | 'recordId' | 'revision'>, yes: boolean, note?: string) =>
    apiClient.post<Ask[]>(`/family/children/${child}/asks`, { clubId: ask.clubId, kind: ask.kind, recordId: ask.recordId, revision: ask.revision, yes, note }).then(r => r.data);

/** The three asks every child at a club has; the rest come from the club, one record each. */
export const STANDING: AskKind[] = ['PHOTOS', 'TRIPS', 'MEDICAL'];

type Copy = (en: string, ka: string) => string;

/** A line's words. The three standing asks are ours, in both languages; the club's own requests keep the club's words. */
export function askWords(ask: Ask, first: string, copy: Copy): { title: string; detail: string } {
    switch (ask.kind) {
        case 'PHOTOS': return { title: copy(`Photos of ${first}`, `${first}-ს ფოტოები`), detail: copy(`Followers of ${ask.clubName} see them only with your yes.`, `${ask.clubName}-ის გამომწერები მათ მხოლოდ თქვენი თანხმობით ნახავენ.`) };
        case 'TRIPS': return { title: copy('Trips with the squad', 'გასვლები გუნდთან ერთად'), detail: copy('You still get each trip’s details and can say no to it.', 'თითოეული გასვლის დეტალებს მიიღებთ და უარის თქმაც შეგიძლიათ.') };
        case 'MEDICAL': return { title: copy('A note for the coach', 'შენიშვნა მწვრთნელისთვის'), detail: copy('An allergy, asthma. Only the squad’s coaches read it.', 'ალერგია, ასთმა. მას მხოლოდ გუნდის მწვრთნელები წაიკითხავენ.') };
        case 'PARTICIPATION': return { title: copy(`${first} playing at ${ask.clubName}`, `${first} თამაშობს კლუბში: ${ask.clubName}`), detail: copy('A parent’s yes lets the coach place them.', 'მშობლის თანხმობით მწვრთნელი მათ გუნდში ჩასვამს.') };
        default: return { title: ask.title ?? '', detail: ask.wording ?? '' };
    }
}
