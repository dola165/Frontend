import type { TFunction } from 'i18next';
import { playerPositionChoices, playerPositionLabel } from '../../features/players/playerIdentityLabels';
import { appLanguage } from '../../utils/formatting';

// Long position names some records carry, mapped to the positions that have Georgian names.
const positionAliases: Record<string, string> = { RIGHT_BACK: 'RB', LEFT_BACK: 'LB', CENTRE_BACK: 'CB', RIGHT_WINGER: 'RW', LEFT_WINGER: 'LW', RIGHT_MIDFIELDER: 'RM', LEFT_MIDFIELDER: 'LM', CENTRE_FORWARD: 'CF', CENTER_FORWARD: 'CF', CDM: 'DM', CAM: 'AM' };
const knownPositions = new Set<string>(playerPositionChoices.map(([code]) => code));

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
    const position = positionAliases[value] ?? value;
    if (knownPositions.has(position)) return playerPositionLabel(position, (en, ka) => appLanguage() === 'ka' ? ka : en);
    return value.replaceAll('_', ' ').replace(/\b[A-Z]{3,}\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());
};

/** The short code a position goes by on a player card: GK, CB, CM, ST… */
export const positionCode = (value: string | null | undefined) => ({
    GOALKEEPER: 'GK', RIGHT_BACK: 'RB', LEFT_BACK: 'LB', CENTER_BACK: 'CB', CENTRE_BACK: 'CB', FULLBACK: 'FB', DEFENDER: 'DF', WING_BACK: 'WB',
    DEFENSIVE_MIDFIELDER: 'CDM', CENTRAL_MIDFIELDER: 'CM', ATTACKING_MIDFIELDER: 'CAM', MIDFIELDER: 'MF', RIGHT_MIDFIELDER: 'RM', LEFT_MIDFIELDER: 'LM',
    RIGHT_WINGER: 'RW', LEFT_WINGER: 'LW', WINGER: 'W', STRIKER: 'ST', CENTRE_FORWARD: 'CF', CENTER_FORWARD: 'CF', FORWARD: 'FW',
} as Record<string, string>)[value ?? ''] ?? (value ? value.split('_').map(part => part[0]).join('').slice(0, 3) : '');
