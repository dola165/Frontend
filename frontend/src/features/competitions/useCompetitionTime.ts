import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { competitionInstant } from './competitionTime';

/** Inputs always mean wall time in the competition's published zone. */
export function useCompetitionTime(zone = 'Asia/Tbilisi') {
    const { i18n } = useTranslation();
    const [error, setError] = useState('');
    const resolve = (value: string): string | null => {
        try { const instant = competitionInstant(value, zone).toISOString(); setError(''); return instant; }
        catch (cause) {
            const ambiguous = cause instanceof Error && cause.message.includes('unambiguous');
            setError(i18n.language.startsWith('ka')
                ? ambiguous ? 'აირჩიეთ დრო საათის სეზონური ცვლილების ინტერვალის გარეთ.' : 'აირჩიეთ ტურნირის სწორი თარიღი და დრო.'
                : ambiguous ? 'Choose an unambiguous time outside a daylight-saving clock change.' : 'Choose a valid competition date and time.');
            return null;
        }
    };
    return { resolve, error };
}
