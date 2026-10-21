export interface PreviewPayment {
    kind: 'order' | 'contribution';
    sourceId: number;
    clubName: string;
    title: string;
    currency: string;
    amount: number; // Minor units, from the cart quote or validated contribution input.
    lines: string[];
}
export interface PreviewRecord extends PreviewPayment {
    id: string;
    createdAt: string;
    status: 'paid' | 'declined' | 'refunded';
}
export const previewKey = (scope: string) => `gk.payment-preview.v1.${encodeURIComponent(scope)}`;
export function readPreviewRecords(scope: string): PreviewRecord[] {
    try {
        const records: unknown = JSON.parse(localStorage.getItem(previewKey(scope)) ?? '[]');
        if (!Array.isArray(records)) return [];
        return records.filter((r): r is PreviewRecord => r &&
            typeof r.id === 'string' && typeof r.createdAt === 'string' &&
            Number.isFinite(Date.parse(r.createdAt)) &&
            ['paid', 'declined', 'refunded'].includes(r.status) &&
            ['order', 'contribution'].includes(r.kind) &&
            Number.isSafeInteger(r.sourceId) && r.sourceId > 0 &&
            Number.isSafeInteger(r.amount) && r.amount > 0 &&
            ['GEL', 'EUR', 'GBP', 'USD'].includes(r.currency) &&
            typeof r.clubName === 'string' && typeof r.title === 'string' &&
            Array.isArray(r.lines) && r.lines.every((line: unknown) => typeof line === 'string')
        ).slice(0, 100);
    } catch { return []; }
}
export function contributionMinorUnits(value: string): number | null {
    if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(value.trim())) return null;
    const amount = Math.round(Number(value) * 100);
    return amount >= 100 && amount <= 100000 ? amount : null;
}
