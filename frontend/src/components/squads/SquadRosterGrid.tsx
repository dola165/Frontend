import { useState } from 'react';
import { CreditCard, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type SquadRosterGroup, type SquadRosterPlayer } from './SquadRosterTable';
import {
    RosterAvatar,
    RosterProfileLink,
    RosterManagementBadges,
    RosterPlayerEditor,
    type UpdateRosterPlayer,
} from './squadRosterPresentation';
import { squadLabel } from './squadLabels';
import './squad-roster.css';

interface SquadRosterGridProps {
    groups: SquadRosterGroup[];
    editable?: boolean;
    /** Private account/trial context is shown only in a management view. */
    showManagementDetails?: boolean;
    onRemovePlayer?: (userId: number, playerName: string) => void;
    onUpdatePlayer?: UpdateRosterPlayer;
    removingPlayerId?: number | null;
    cardUserIds?: Set<number> | null;
    onEditCard?: (userId: number) => void;
    onOpenPlayer?: (player: SquadRosterPlayer) => void;
}

const PlayerCard = ({
    player,
    editable,
    showManagementDetails,
    onRemovePlayer,
    onUpdatePlayer,
    isRemoving,
    isCard,
    onEditCard,
    onOpenPlayer,
}: {
    player: SquadRosterPlayer;
    editable: boolean;
    showManagementDetails: boolean;
    onRemovePlayer?: (userId: number, playerName: string) => void;
    onUpdatePlayer?: UpdateRosterPlayer;
    isRemoving: boolean;
    isCard: boolean;
    onEditCard?: (userId: number) => void;
    onOpenPlayer?: (player: SquadRosterPlayer) => void;
}) => {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    return (
        <article className="sr-player-card">
            <div className="sr-card-top">
                <RosterProfileLink player={player} avatar><RosterAvatar player={player} /></RosterProfileLink>
                <span
                    className="sr-shirt"
                    aria-label={t('squadDesign.roster.shirtNumber', { defaultValue: 'Shirt number' })}
                >
                    {player.number ?? '—'}
                </span>
            </div>
            <h4><>{onOpenPlayer ? <button type="button" className="wo-player-name" onClick={() => onOpenPlayer(player)} aria-label={`Open ${player.name} details`}>{player.name}</button> : <RosterProfileLink player={player}>{player.name}</RosterProfileLink>}</></h4>
            <div className="sr-card-meta">
                <span>{squadLabel(player.position, t)}</span>
                {player.age != null && (
                    <span>{t('squadDesign.roster.ageValue', { defaultValue: 'Age {{age}}', age: player.age })}</span>
                )}
            </div>
            {player.squadRole &&
                player.squadRole !== 'PLAYER' &&
                player.squadRole !== player.position &&
                (showManagementDetails || player.squadRole !== 'TRIALIST') && (
                    <span className="sr-role">{squadLabel(player.squadRole, t)}</span>
                )}
            {showManagementDetails && (
                <div className="sr-management">
                    <RosterManagementBadges player={player} />
                </div>
            )}
            {editable && (
                <div className="sr-card-actions">
                    {onUpdatePlayer && (
                        <button
                            type="button"
                            className="sd-button"
                            onClick={() => setEditing((value) => !value)}
                            aria-expanded={editing}
                        >
                            <Pencil size={13} />
                            {t('squadDesign.roster.edit', { defaultValue: 'Edit' })}
                        </button>
                    )}
                    {isCard && onEditCard && (
                        <button
                            type="button"
                            className="sd-icon-button"
                            onClick={() => onEditCard(player.id)}
                            aria-label={t('squadDesign.roster.editCard', {
                                defaultValue: 'Edit player card for {{name}}',
                                name: player.name,
                            })}
                        >
                            <CreditCard size={15} />
                        </button>
                    )}
                    {onRemovePlayer && (
                        <button
                            type="button"
                            className="sd-icon-button sr-remove"
                            onClick={() => onRemovePlayer(player.id, player.name)}
                            disabled={isRemoving}
                            aria-label={t('squadDesign.roster.removePlayer', {
                                defaultValue: 'Remove {{name}} from squad',
                                name: player.name,
                            })}
                        >
                            {isRemoving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                    )}
                </div>
            )}
            {editing && editable && onUpdatePlayer && (
                <RosterPlayerEditor player={player} onSave={onUpdatePlayer} onClose={() => setEditing(false)} />
            )}
        </article>
    );
};

export const SquadRosterGrid = ({
    groups,
    editable = false,
    showManagementDetails = editable,
    onRemovePlayer,
    onUpdatePlayer,
    removingPlayerId,
    cardUserIds,
    onEditCard,
    onOpenPlayer,
}: SquadRosterGridProps) => {
    const { t } = useTranslation();
    const nonEmptyGroups = groups.filter((group) => group.players.length);
    if (nonEmptyGroups.length === 0)
        return (
            <div className="sd-empty">
                <p>{t('squadDesign.roster.empty', { defaultValue: 'No players to show in this squad yet.' })}</p>
            </div>
        );
    return (
        <div className="sr-roster sr-grid">
            {nonEmptyGroups.map((group) => (
                <section key={group.label}>
                    <div className="sr-group-heading">
                        <h3>{squadLabel(group.label, t)}</h3>
                        <span>{group.players.length}</span>
                    </div>
                    <div className="sr-card-grid">
                        {group.players.map((player) => (
                            <PlayerCard
                                key={player.id}
                                player={player}
                                editable={editable}
                                showManagementDetails={showManagementDetails}
                                onRemovePlayer={onRemovePlayer}
                                onUpdatePlayer={onUpdatePlayer}
                                isRemoving={removingPlayerId === player.id}
                                isCard={cardUserIds?.has(player.id) ?? false}
                                onEditCard={onEditCard}
                                onOpenPlayer={onOpenPlayer}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};
