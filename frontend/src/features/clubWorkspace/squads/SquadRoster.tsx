import { useTranslation } from 'react-i18next';
import { LayoutGrid, List as ListIcon, Plus } from 'lucide-react';
import { Button, Chip, EmptyNote, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import { SquadRosterTable, type SquadRosterGroup, type SquadRosterPlayer } from '../../../components/squads/SquadRosterTable';
import { SquadRosterGrid } from '../../../components/squads/SquadRosterGrid';
import { squadLabel } from '../../../components/squads/squadLabels';
import type { UpdateRosterPlayer } from '../../../components/squads/squadRosterPresentation';
import { LegacyIsland } from '../../clubOperations/records/LegacyIsland';
import '../../../components/squads/squad-design.css';

interface Props {
    squadId: number; groups: SquadRosterGroup[]; visibleGroups: SquadRosterGroup[]; loading: boolean; error: string | null; onRetry: () => void;
    query: string; position: string; onQuery: (value: string) => void; onPosition: (value: string) => void; onClear: () => void;
    cardView: boolean; onCardView: (value: boolean) => void; onAddPlayers: () => void;
    onOpenPlayer?: (player: SquadRosterPlayer) => void; onRemovePlayer: (userId: number, name: string) => void; onUpdatePlayer: UpdateRosterPlayer;
    removingPlayerId: number | null; cardUserIds: Set<number>; onEditCard: (userId: number) => void;
}

/** A squad's players: search, position and view, then the roster grouped by position. */
export function SquadRoster(p: Props) {
    const { t } = useTranslation();
    const total = p.groups.reduce((sum, group) => sum + group.players.length, 0);
    const visible = p.visibleGroups.reduce((sum, group) => sum + group.players.length, 0);
    const filtered = Boolean(p.query || p.position);
    const roster = { groups: p.visibleGroups, editable: true, onOpenPlayer: p.onOpenPlayer, onRemovePlayer: p.onRemovePlayer, onUpdatePlayer: p.onUpdatePlayer, removingPlayerId: p.removingPlayerId, cardUserIds: p.cardUserIds, onEditCard: p.onEditCard };
    return <div className="gk-stack gk-stack--tight">
        <div className="rec-toolbar">
            <SearchInput className="rec-toolbar__search" aria-label={t('squads.design.searchPlayers', { defaultValue: 'Search players or shirt number' })} placeholder="Search players or shirt number" value={p.query} onChange={e => p.onQuery(e.target.value)} />
            <select className="gk-input" aria-label={t('squads.design.position', { defaultValue: 'Position' })} value={p.position} onChange={e => p.onPosition(e.target.value)}>
                <option value="">{t('squads.design.allPositions', { defaultValue: 'All positions' })}</option>
                {p.groups.filter(group => group.players.length > 0).map(group => <option key={group.label} value={group.label}>{squadLabel(group.label, t)}</option>)}
            </select>
            <div className="gk-chips" role="group" aria-label={t('squads.design.rosterView', { defaultValue: 'Roster view' })}>
                <Chip pressed={!p.cardView} onClick={() => p.onCardView(false)}><ListIcon aria-hidden="true" />{t('squads.design.roster', { defaultValue: 'Roster' })}</Chip>
                <Chip pressed={p.cardView} onClick={() => p.onCardView(true)}><LayoutGrid aria-hidden="true" />{t('squads.design.cards', { defaultValue: 'Cards' })}</Chip>
            </div>
            <span className="rec-toolbar__count" role="status">{filtered ? `${visible} of ${total} players` : `${total} ${total === 1 ? 'player' : 'players'}`}</span>
        </div>
        {p.loading ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading roster">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
            : p.error ? <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{p.error}</span><Button size="sm" onClick={p.onRetry}>{t('squads.design.retry', { defaultValue: 'Try again' })}</Button></div>
                : total === 0 ? <Panel><EmptyNote title={t('squads.design.emptyRoster', { defaultValue: 'A team starts with its players' })} action={<Button size="sm" onClick={p.onAddPlayers}><Plus aria-hidden="true" />{t('squads.design.addPlayers', { defaultValue: 'Add players' })}</Button>}>
                    {t('squads.design.emptyRosterIntro', { defaultValue: 'Add club players to this squad, or create a card for someone without an account.' })}</EmptyNote></Panel>
                    : visible === 0 ? <Panel><EmptyNote title={t('squads.design.noMatches', { defaultValue: 'No players match these filters.' })} action={<Button size="sm" onClick={p.onClear}>{t('squads.design.clearFilters', { defaultValue: 'Clear filters' })}</Button>} /></Panel>
                        : <LegacyIsland className="squad-design">{p.cardView ? <SquadRosterGrid key={p.squadId} {...roster} /> : <SquadRosterTable key={p.squadId} {...roster} />}</LegacyIsland>}
    </div>;
}
