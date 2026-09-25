import type { TFunction } from 'i18next';

export const squadLabel = (value: string | null | undefined, t: TFunction): string => {
    if (!value) return t('squadDesign.roster.unspecified', { defaultValue: 'Not specified' });
    const labels: Record<string, string> = {
        SENIOR: 'Senior',
        MALE: 'Male',
        FEMALE: 'Female',
        MIXED: 'Mixed',
        GOALKEEPER: 'Goalkeeper',
        DEFENDER: 'Defender',
        CENTER_BACK: 'Centre-back',
        FULLBACK: 'Full-back',
        MIDFIELDER: 'Midfielder',
        DEFENSIVE_MIDFIELDER: 'Defensive midfielder',
        CENTRAL_MIDFIELDER: 'Central midfielder',
        ATTACKING_MIDFIELDER: 'Attacking midfielder',
        FORWARD: 'Forward',
        STRIKER: 'Striker',
        WINGER: 'Winger',
        PLAYER: 'Player',
        CAPTAIN: 'Captain',
        TRIALIST: 'Trialist',
        Goalkeepers: 'Goalkeepers',
        Defenders: 'Defenders',
        Midfielders: 'Midfielders',
        Forwards: 'Forwards',
        Others: 'Other players',
        Other: 'Other players',
        Unspecified: 'Other players',
    };
    if (labels[value]) return t(`squadDesign.labels.${value}`, { defaultValue: labels[value] });
    return value.replaceAll('_', ' ').replace(/\b[A-Z]{3,}\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());
};
