import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, List as ListIcon, Plus } from 'lucide-react';
import { Button, EmptyNote, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import type { SquadRosterGroup, SquadRosterPlayer } from '../../../components/squads/SquadRosterTable';
import { squadLabel } from '../../../components/squads/squadLabels';
import type { UpdateRosterPlayer } from '../../../components/squads/squadRosterPresentation';
import { SquadRosterList, type RosterSort } from './SquadRosterList';
import '../club-workspace.css';
import '../../clubOperations/records/records.css';

interface Props {
    squadId: number; groups: SquadRosterGroup[]; visibleGroups: SquadRosterGroup[]; loading: boolean; error: string | null; onRetry: () => void;
    query: string; position: string; onQuery: (value: string) => void; onPosition: (value: string) => void; onClear: () => void;
    cardView: boolean; onCardView: (value: boolean) => void; onAddPlayers: () => void;
    onOpenPlayer?: (player: SquadRosterPlayer) => void; onRemovePlayer: (userId: number, name: string) => void; onUpdatePlayer: UpdateRosterPlayer;
    removingPlayerId: number | null; cardUserIds: Set<number>; onEditCard: (userId: number) => void;
}

/** A squad's players: search, position, order and view, then the roster grouped by position. */
export function SquadRoster(p: Props) {
    const { t } = useTranslation();
    const [sort, setSort] = useState<RosterSort | ''>('');
    const total = p.groups.reduce((sum, group) => sum + group.players.length, 0);
    const visible = p.visibleGroups.reduce((sum, group) => sum + group.players.length, 0);
    const filtered = Boolean(p.query || p.position);
    return <div className="gk-stack gk-stack--tight">
        <div className="rec-toolbar">
            <SearchInput className="rec-toolbar__search" aria-label={t('squads.design.searchPlayers', { defaultValue: 'Search players or shirt number' })} placeholder={t('squads.design.searchPlayers', { defaultValue: 'Search players or shirt number' })} value={p.query} onChange={e => p.onQuery(e.target.value)} />
            <select className="gk-input" aria-label={t('squads.design.position', { defaultValue: 'Position' })} value={p.position} onChange={e => p.onPosition(e.target.value)}>
                <option value="">{t('squads.design.allPositions', { defaultValue: 'All positions' })}</option>
                {p.groups.filter(group => group.players.length > 0).map(group => <option key={group.label} value={group.label}>{squadLabel(group.label, t)}</option>)}
            </select>
            <select className="gk-input" aria-label={t('squads.design.order', { defaultValue: 'Order' })} value={sort} onChange={e => setSort(e.target.value as RosterSort | '')}>
                <option value="">{t('squads.design.orderSquad', { defaultValue: 'Squad order' })}</option>
                <option value="number">{t('squads.design.orderNumber', { defaultValue: 'Shirt number' })}</option>
                <option value="name">{t('squads.design.orderName', { defaultValue: 'Name' })}</option>
                <option value="age">{t('squads.design.orderAge', { defaultValue: 'Age' })}</option>
            </select>
            <Segmented label={t('squads.design.rosterView', { defaultValue: 'Roster view' })} value={p.cardView ? 'cards' : 'list'} onChange={value => p.onCardView(value === 'cards')} items={[
                { id: 'list', label: t('squads.design.roster', { defaultValue: 'Roster' }), icon: <ListIcon aria-hidden="true" /> },
                { id: 'cards', label: t('squads.design.cards', { defaultValue: 'Cards' }), icon: <LayoutGrid aria-hidden="true" /> },
            ]} />
            <span className="rec-toolbar__count" role="status">{filtered
                ? t('squads.design.showingCount', { defaultValue: '{{visible}} of {{total}} players', visible, total })
                : t('squads.design.playerCount', { defaultValue: '{{count}} players', count: total })}</span>
        </div>
        {p.loading ? <Panel><div className="cw-skeleton-rows" role="status" aria-label={t('squads.design.loadingRoster', { defaultValue: 'Loading roster…' })}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
            : p.error ? <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{p.error}</span><Button size="sm" onClick={p.onRetry}>{t('squads.design.retry', { defaultValue: 'Try again' })}</Button></div>
                : total === 0 ? <Panel><EmptyNote title={t('squads.design.emptyRoster', { defaultValue: 'A team starts with its players' })} action={<Button size="sm" onClick={p.onAddPlayers}><Plus aria-hidden="true" />{t('squads.design.addPlayers', { defaultValue: 'Add players' })}</Button>}>
                    {t('squads.design.emptyRosterIntro', { defaultValue: 'Add club players to this squad, or create a card for someone without an account.' })}</EmptyNote></Panel>
                    : visible === 0 ? <Panel><EmptyNote title={t('squads.design.noMatches', { defaultValue: 'No players match these filters.' })} action={<Button size="sm" onClick={p.onClear}>{t('squads.design.clearFilters', { defaultValue: 'Clear filters' })}</Button>} /></Panel>
                        : <SquadRosterList key={p.squadId} groups={p.visibleGroups} cardView={p.cardView} sort={sort || null} actions={{
                            onOpenPlayer: p.onOpenPlayer, onRemovePlayer: p.onRemovePlayer, onUpdatePlayer: p.onUpdatePlayer,
                            removingPlayerId: p.removingPlayerId, cardUserIds: p.cardUserIds, onEditCard: p.onEditCard,
                        }} />}
    </div>;
}
