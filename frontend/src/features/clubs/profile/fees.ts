import { currentProgramme, money, periodLabel, type TrainingProgramme } from '../presentation';

/** The lowest and highest current published fee, as one line, and whether a free trial or free group exists. */
export function feeRange(programmes: TrainingProgramme[]) {
    const current = programmes.filter(p => p.published && currentProgramme(p));
    const priced = current.filter(p => p.priceType === 'FIXED' && p.amount != null);
    const free = current.some(p => p.priceType === 'FREE');
    if (!priced.length) return free ? { range: 'Free training', note: undefined } : null;
    const sorted = [...priced].sort((a, b) => Number(a.amount) - Number(b.amount));
    const low = sorted[0], high = sorted[sorted.length - 1];
    const period = sorted.every(p => p.billingPeriod === low.billingPeriod) ? ` / ${periodLabel[low.billingPeriod]}` : '';
    const range = low === high || low.amount === high.amount ? `${money(low.amount!, low.currency)}${period}`
        : low.currency === high.currency ? `${money(low.amount!, low.currency).replace(` ${low.currency}`, '')}–${money(high.amount!, high.currency)}${period}`
        : `${money(low.amount!, low.currency)} – ${money(high.amount!, high.currency)}${period}`;
    const trials = current.map(p => p.trialAmount).filter((t): t is string => t != null).map(Number);
    const note = free ? 'Some groups train free' : trials.length ? (Math.min(...trials) === 0 ? 'First session free' : `Trial from ${money(String(Math.min(...trials)), low.currency)}`) : undefined;
    return { range, note };
}
