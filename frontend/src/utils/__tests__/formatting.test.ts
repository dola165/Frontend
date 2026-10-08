import { afterEach, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import '../../i18n';
import { appLocale, formatDate, formatDateTime, formatMoney } from '../formatting';
import { campaignDate, campaignMoney } from '../../features/campaigns/api';
import { formatStorePrice } from '../../features/store/api';

afterEach(async () => { await i18next.changeLanguage('en'); });

describe('selected-language presentation', () => {
    it('uses the same English currency format across Store and Campaigns', async () => {
        await i18next.changeLanguage('en');
        expect(appLocale()).toBe('en-GB');
        const expected = new Intl.NumberFormat('en-GB', {style:'currency',currency:'GEL',minimumFractionDigits:2,maximumFractionDigits:2}).format(1234.5);
        expect(formatMoney(1234.5)).toBe(expected);
        expect(campaignMoney(1234.5, 'GEL')).toBe(expected);
        expect(formatStorePrice(1234.5)).toBe(expected);
    });
    it('responds to Georgian selection and regional language codes', async () => {
        await i18next.changeLanguage('ka-GE');
        expect(appLocale()).toBe('ka-GE');
        expect(formatMoney(1234.5, 'EUR')).toBe(new Intl.NumberFormat('ka-GE', {style:'currency',currency:'EUR'}).format(1234.5));
        expect(formatDate('2026-09-10')).toBe(new Intl.DateTimeFormat('ka-GE', {day:'numeric',month:'short',year:'numeric'}).format(new Date(2026,8,10,12)));
    });
    it('preserves calendar-only dates and handles missing/invalid values', async () => {
        await i18next.changeLanguage('en');
        expect(campaignDate('2026-09-10')).toBe('10 Sept 2026');
        expect(formatDate('2026-02-30')).toBe('—');
        expect(formatDateTime('invalid')).toBe('—');
        expect(formatMoney(NaN)).toBe('—');
    });
});
