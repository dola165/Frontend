import type { ChildFeeLine, ChildFees, SquadPrice } from '../api';

type Copy = (en: string, ka: string) => string;

/** "120 GEL", "99.50 GEL": whole amounts without decimals. */
export const money = (amount: number | null, currency: string | null) => amount == null ? 'Amount not known' : `${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${currency ?? 'Currency not known'}`;

const PER: Record<NonNullable<SquadPrice['period']>, [string, string]> = {
    SESSION: ['a session', 'ერთ ვარჯიშზე'], MONTH: ['a month', 'თვეში'], TERM: ['a term', 'სემესტრში'], YEAR: ['a year', 'წელიწადში'], ONE_OFF: ['once', 'ერთჯერადად'],
};

/**
 * What the club charges for a squad, as its "Programmes and fees" publishes it: "120 GEL a month", "Free", "Price
 * varies", "Fee not published". With nothing set: "No fee set by the club". Never an invented amount.
 */
export function priceLabel(price: SquadPrice | null | undefined, copy: Copy) {
    if (!price) return copy('No fee set by the club', 'კლუბს საფასური არ დაუწესებია');
    if (price.type === 'FREE') return copy('Free', 'უფასო');
    if (price.type === 'VARIES') return copy('Price varies', 'ფასი იცვლება');
    if (price.type === 'UNPUBLISHED' || price.amount == null) return copy('Fee not published', 'საფასური არ არის გამოქვეყნებული');
    const [en, ka] = price.period ? PER[price.period] : ['', ''];
    return copy(`${money(price.amount, price.currency)}${en ? ` ${en}` : ''}`, `${money(price.amount, price.currency)}${ka ? ` ${ka}` : ''}`);
}

/** The next instalment still to pay for this squad, else for the club as a whole; overdue first. */
export function nextDue(fees: ChildFees | null | undefined, squadId?: number): ChildFeeLine | null {
    const open = (fees?.lines ?? []).filter(line => line.status === 'DUE' || line.status === 'OVERDUE');
    const mine = open.filter(line => squadId != null && line.squadId === squadId);
    const pool = mine.length ? mine : open.filter(line => line.squadId == null);
    return [...pool].sort((a, b) => (a.status === 'OVERDUE' ? 0 : 1) - (b.status === 'OVERDUE' ? 0 : 1) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))[0] ?? null;
}

/** The last instalment the club recorded as paid (or waived): "October: paid". */
export function lastSettled(fees: ChildFees | null | undefined): ChildFeeLine | null {
    return (fees?.lines ?? []).filter(line => line.status === 'PAID' || line.status === 'WAIVED').sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''))[0] ?? null;
}
