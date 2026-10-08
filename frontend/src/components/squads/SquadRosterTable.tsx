import { Fragment, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CreditCard, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    RosterAvatar,
    RosterProfileLink,
    RosterManagementBadges,
    RosterPlayerEditor,
    type UpdateRosterPlayer,
} from './squadRosterPresentation';
import { squadLabel } from './squadLabels';
import './squad-roster.css';

export interface SquadRosterPlayer {
    id: number;
    number?: number | null;
    name: string;
    position?: string | null;
    age?: number | null;
    status?: string | null;
    joinedAt?: string | null;
    photoUrl?: string | null;
    isRegistered?: boolean;
    squadRole?: string | null;
}

export interface SquadRosterGroup {
    label: string;
    players: SquadRosterPlayer[];
}

interface SquadRosterTableProps {
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

type SortColumn = 'number' | 'name' | 'age' | 'position';

export const SquadRosterTable = ({
    groups,
    editable = false,
    showManagementDetails = editable,
    onRemovePlayer,
    onUpdatePlayer,
    removingPlayerId,
    cardUserIds,
    onEditCard,
    onOpenPlayer,
}: SquadRosterTableProps) => {
    const { t } = useTranslation();
    const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
    const [sort, setSort] = useState<{ column: SortColumn; direction: 'asc' | 'desc' } | null>(null);
    const sortedGroups = useMemo(
        () =>
            groups
                .filter((group) => group.players.length)
                .map((group) => ({
                    ...group,
                    players: sort
                        ? [...group.players].sort((a, b) => {
                              const aValue = a[sort.column];
                              const bValue = b[sort.column];
                              if (aValue == null && bValue == null) return 0;
                              if (aValue == null) return 1;
                              if (bValue == null) return -1;
                              const comparison =
                                  typeof aValue === 'number' && typeof bValue === 'number'
                                      ? aValue - bValue
                                      : String(aValue).localeCompare(String(bValue));
                              return sort.direction === 'asc' ? comparison : -comparison;
                          })
                        : group.players,
                })),
        [groups, sort],
    );
    const columns: { column: SortColumn; label: string }[] = [
        { column: 'number', label: t('squadDesign.roster.number', { defaultValue: 'No.' }) },
        { column: 'name', label: t('squadDesign.roster.player', { defaultValue: 'Player' }) },
        { column: 'position', label: t('squadDesign.roster.position', { defaultValue: 'Position' }) },
        { column: 'age', label: t('squadDesign.roster.age', { defaultValue: 'Age' }) },
    ];
    if (sortedGroups.length === 0)
        return (
            <div className="sd-empty">
                <p>{t('squadDesign.roster.empty', { defaultValue: 'No players to show in this squad yet.' })}</p>
            </div>
        );
    return (
        <div className="sr-roster sr-table-groups">
            {sortedGroups.map((group) => (
                <section key={group.label} data-position-group={group.label}>
                    <div className="sr-group-heading">
                        <h3>{squadLabel(group.label, t)}</h3>
                        <span>{group.players.length}</span>
                    </div>
                    <div className="sr-table-scroll">
                        <table className="sr-table">
                            <thead>
                                <tr>
                                    {columns.map(({ column, label }) => (
                                        <th
                                            key={column}
                                            className={`sr-col-${column}`}
                                            scope="col"
                                            aria-sort={
                                                sort?.column === column
                                                    ? sort.direction === 'asc'
                                                        ? 'ascending'
                                                        : 'descending'
                                                    : 'none'
                                            }
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSort((value) => ({
                                                        column,
                                                        direction:
                                                            value?.column === column && value.direction === 'asc'
                                                                ? 'desc'
                                                                : 'asc',
                                                    }))
                                                }
                                            >
                                                {label}
                                                {sort?.column === column ? (
                                                    sort.direction === 'asc' ? (
                                                        <ArrowUp size={11} />
                                                    ) : (
                                                        <ArrowDown size={11} />
                                                    )
                                                ) : (
                                                    <ArrowUpDown size={11} />
                                                )}
                                            </button>
                                        </th>
                                    ))}
                                    {editable && (
                                        <th scope="col" className="sr-col-actions">
                                            <span className="sr-sr-only">
                                                {t('squadDesign.roster.actions', { defaultValue: 'Actions' })}
                                            </span>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {group.players.map((player) => (
                                    <Fragment key={player.id}>
                                        <tr>
                                            <td className="sr-col-number">
                                                {editable && onUpdatePlayer ? (
                                                    <button
                                                        type="button"
                                                        className="sr-number-button"
                                                        aria-label={t('squadDesign.roster.editNumber', {
                                                            defaultValue: 'Edit shirt number for {{name}}',
                                                            name: player.name,
                                                        })}
                                                        onClick={() => setEditingPlayerId(player.id)}
                                                    >
                                                        {player.number ?? '—'}
                                                    </button>
                                                ) : (
                                                    <span className="sr-number">{player.number ?? '—'}</span>
                                                )}
                                            </td>
                                            <td className="sr-col-name">
                                                <div className="sr-player-name">
                                                    <RosterProfileLink player={player} avatar><RosterAvatar player={player} /></RosterProfileLink>
                                                    <div>
                                                        <strong><>{onOpenPlayer ? <button type="button" className="wo-player-name" onClick={() => onOpenPlayer(player)} aria-label={`Open ${player.name} details`}>{player.name}</button> : <RosterProfileLink player={player}>{player.name}</RosterProfileLink>}</></strong>
                                                        <div className="sr-name-meta">
                                                            {player.squadRole &&
                                                                player.squadRole !== 'PLAYER' &&
                                                                player.squadRole !== player.position &&
                                                                (showManagementDetails ||
                                                                    player.squadRole !== 'TRIALIST') && (
                                                                    <span className="sr-role">
                                                                        {squadLabel(player.squadRole, t)}
                                                                    </span>
                                                                )}
                                                            {showManagementDetails && (
                                                                <RosterManagementBadges player={player} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="sr-col-position"><span className="sr-position">{squadLabel(player.position, t)}</span></td>
                                            <td className="sr-col-age">{player.age ?? '—'}</td>
                                            {editable && (
                                                <td className="sr-col-actions">
                                                    <div className="sr-row-actions">
                                                        {onUpdatePlayer && (
                                                            <button
                                                                type="button"
                                                                className="sd-icon-button"
                                                                aria-label={t('squadDesign.roster.editPlayer', {
                                                                    defaultValue: 'Edit {{name}}',
                                                                    name: player.name,
                                                                })}
                                                                aria-expanded={editingPlayerId === player.id}
                                                                onClick={() =>
                                                                    setEditingPlayerId((value) =>
                                                                        value === player.id ? null : player.id,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                        )}
                                                        {cardUserIds?.has(player.id) && onEditCard && (
                                                            <button
                                                                type="button"
                                                                className="sd-icon-button"
                                                                aria-label={t('squadDesign.roster.editCard', {
                                                                    defaultValue: 'Edit player card for {{name}}',
                                                                    name: player.name,
                                                                })}
                                                                onClick={() => onEditCard(player.id)}
                                                            >
                                                                <CreditCard size={15} />
                                                            </button>
                                                        )}
                                                        {onRemovePlayer && (
                                                            <button
                                                                type="button"
                                                                className="sd-icon-button sr-remove"
                                                                aria-label={t('squadDesign.roster.removePlayer', {
                                                                    defaultValue: 'Remove {{name}} from squad',
                                                                    name: player.name,
                                                                })}
                                                                onClick={() => onRemovePlayer(player.id, player.name)}
                                                                disabled={removingPlayerId === player.id}
                                                            >
                                                                {removingPlayerId === player.id ? (
                                                                    <Loader2 size={15} className="animate-spin" />
                                                                ) : (
                                                                    <Trash2 size={15} />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                        {editable && editingPlayerId === player.id && onUpdatePlayer && (
                                            <tr className="sr-edit-row">
                                                <td colSpan={5}>
                                                    <RosterPlayerEditor
                                                        player={player}
                                                        onSave={onUpdatePlayer}
                                                        onClose={() => setEditingPlayerId(null)}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </div>
    );
};
