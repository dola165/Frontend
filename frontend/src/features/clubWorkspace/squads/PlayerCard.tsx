import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { positionCode, squadLabel } from '../../../components/squads/squadLabels';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import './player-card.css';

export interface PlayerCardPlayer {
    id: number; name: string; number?: number | null; position?: string | null; age?: number | null;
    photoUrl?: string | null; squadRole?: string | null; status?: string | null;
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');

/**
 * A player as a football card: shirt number and position in the corner, the club crest, a large photo (a profile
 * picture once the player has one), name and facts. No ratings: everything on it is true. Signs (captain, trial,
 * injury) sit along the bottom; management actions, where allowed, appear on hover.
 */
export function PlayerCard({ player, crest, subtitle, signs, onOpen, actions, children }: {
    player: PlayerCardPlayer; crest?: string | null; subtitle?: ReactNode; signs?: ReactNode; onOpen?: () => void; actions?: ReactNode; children?: ReactNode;
}) {
    const { t } = useTranslation();
    const photo = resolveMediaUrl(player.photoUrl);
    const captain = player.squadRole === 'CAPTAIN', trial = player.status === 'TRIALIST';
    const facts = [player.position ? squadLabel(player.position, t) : null, player.age != null ? t('squadDesign.roster.ageValue', { defaultValue: 'Age {{age}}', age: player.age }) : null].filter(Boolean).join(' · ');
    const face = <>
        <span className="pc-card__corner" aria-hidden="true"><span className="pc-card__number">{player.number ?? '–'}</span><span className="pc-card__position">{positionCode(player.position)}</span></span>
        {crest && <img className="pc-card__crest" src={crest} alt="" />}
        <span className="pc-card__photo">{photo ? <img src={photo} alt="" loading="lazy" /> : <span className="pc-card__initials">{initials(player.name)}</span>}</span>
        <span className="pc-card__name">{player.name}</span>
        <span className="pc-card__facts">{facts}{subtitle && <> · {subtitle}</>}</span>
    </>;
    return <article className="pc-card" data-captain={captain || undefined} data-trial={trial || undefined}>
        {onOpen ? <button type="button" className="pc-card__face" onClick={onOpen} aria-label={t('squadDesign.roster.openPlayer', { defaultValue: 'Open {{name}}: notes and tools', name: player.name })}>{face}</button>
            : <div className="pc-card__face">{face}</div>}
        {(captain || trial || signs || actions) && <div className="pc-card__foot">
            <span className="pc-card__signs">
                {captain && <span className="pc-sign pc-sign--captain" title={t('squadDesign.labels.CAPTAIN', { defaultValue: 'Captain' })}>C</span>}
                {trial && <span className="pc-sign pc-sign--trial">{t('squadDesign.trialist', { defaultValue: 'Trialist' })}</span>}
                {signs}
            </span>
            {actions && <span className="pc-card__actions">{actions}</span>}
        </div>}
        {children}
    </article>;
}
