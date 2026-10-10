import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Avatar, Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import { DataTable, EMPTY_CELL, ListToolbar, PrimaryCell, ViewTabs, type Column } from '../../../design/DataTable';
import { nextSort, sortRows, type TableSort } from '../../../design/tableSort';
import { squadLabel } from '../../../components/squads/squadLabels';
import type { ClubPlayerAffiliation, PageResult, PlayerAffiliationStatus } from '../../clubs/domain';
import type { WorkspaceTab } from '../../../components/workspace/types';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formatDate } from '../../../utils/formatting';
import { useNow } from '../useNow';
import { daysFromToday } from '../fixtures';
import { PlayerActions, PlayerConsent, PlayerDetails, PlayerStatus } from './PlayerRow';
import { playerChoices, playerName, trialDay } from './playerChoices';
import '../club-workspace.css';
import './players.css';

type Filter = 'ALL' | PlayerAffiliationStatus;
const FILTERS = ['ALL', 'TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'] as const;
const EMPTY: ClubPlayerAffiliation[] = [];
const shortDate = (value?: string | null) => value ? formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export interface PlayersPageProps {
    playerDirectory: PageResult<ClubPlayerAffiliation> | null; playerLoading: boolean; playerError: string | null;
    playerStatusFilter: Filter; playerCounts?: Partial<Record<Filter, number>>;
    pendingKey: string | null; canManagePlayerStatuses: boolean; canInvitePlayer?: boolean; joiningUnavailableReason?: string; totalPlayerPages: number;
    onStatusFilterChange: (filter: Filter) => void;
    onPlayerStatusChange: (userId: number, status: PlayerAffiliationStatus, playerName?: string) => Promise<void>;
    onReviewJoining?: (userId: number) => void; joiningPlayerIds?: readonly number[];
    onTrialEndsChange: (userId: number, trialEndsOn: string) => Promise<void>;
    onRetry: () => void; onPageChange: (page: number) => void;
    onMessagePlayer?: (userId: number, playerName?: string) => void;
    onSendConsentEmail?: (userId: number, parentEmail?: string | null) => Promise<boolean> | void;
    onTabChange: (tab: WorkspaceTab) => void;
}

/**
 * The club's players as a table: views by status (with whole-club counts from the server), a search over this page,
 * sortable columns, and one row per player with the next step in view. Trial dates, parent consent and status changes
 * open under the row. Search and sort live in the URL.
 */
export function PlayersPage(p: PlayersPageProps) {
    const { t } = useTranslation();
    const reasonId = useId();
    const now = useNow();
    const [params, setParams] = useSearchParams();
    const players = p.playerDirectory?.content ?? EMPTY;
    const query = params.get('q') ?? '', sortBy = params.get('sort'), descending = params.get('dir') === 'desc';
    const sort = useMemo<TableSort | null>(() => sortBy ? { by: sortBy, descending } : null, [sortBy, descending]);
    const copy = (key: string, fallback: string, values?: Record<string, unknown>) => t(`squadDesign.players.${key}`, { defaultValue: fallback, ...values });
    const canInvite = p.canInvitePlayer ?? true;
    const setParam = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
        setParams(next, { replace: true });
    };
    const setQuery = (value: string) => setParam({ q: value });

    // Counts describe the whole club, not just this page; the page fills in only what the server did not send.
    const counts = useMemo(() => {
        const map = {} as Record<Filter, number>;
        for (const status of FILTERS) {
            const value = p.playerCounts?.[status];
            map[status] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : status === 'ALL' ? players.length : players.filter(player => player.status === status).length;
        }
        if (!Number.isFinite(p.playerCounts?.ALL)) map.ALL = FILTERS.filter(status => status !== 'ALL').reduce((total, status) => total + map[status], 0);
        return map;
    }, [players, p.playerCounts]);
    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const found = needle ? players.filter(player => `${player.fullName ?? ''} ${player.username ?? ''}`.toLowerCase().includes(needle)) : players;
        return sortRows(found, sort, (player, by) => ({
            name: playerName(player).toLowerCase(), position: player.position ?? '￿', number: player.jerseyNumber ?? Number.MAX_SAFE_INTEGER,
            status: player.status === 'TRIALIST' ? -(trialDay(player, now) ?? 0) : player.status, consent: player.parentalConsentStatus ?? '￿',
            trialEnds: player.trialEndsOn ?? '9999', joined: player.joinedAt ?? '',
        } as Record<string, string | number>)[by] ?? '');
    }, [players, query, sort, now]);
    const statusLabel = (status: Filter) => t(`squadDesign.players.status.${status}`, { defaultValue: status === 'ALL' ? 'All players' : status === 'TRIALIST' ? 'On trial' : status.charAt(0) + status.slice(1).toLowerCase() });
    const directory = p.playerDirectory;
    const paged = directory && directory.totalElements > directory.pageSize;
    const changePage = (page: number) => { setQuery(''); p.onPageChange(page); };
    const actions = {
        pendingKey: p.pendingKey, canManagePlayerStatuses: p.canManagePlayerStatuses, onPlayerStatusChange: p.onPlayerStatusChange, onTrialEndsChange: p.onTrialEndsChange,
        onReviewJoining: p.onReviewJoining, onOpenAdmissions: () => p.onTabChange('admissions'), onMessagePlayer: p.onMessagePlayer, onSendConsentEmail: p.onSendConsentEmail,
    };
    const managed = (player: ClubPlayerAffiliation) => p.joiningPlayerIds?.includes(player.userId) === true;

    const columns: Column<ClubPlayerAffiliation>[] = [
        { id: 'name', label: copy('sort0', 'Player'), width: 'minmax(220px, 2.4fr)', sortable: true, render: player => <PrimaryCell
            lead={<Avatar src={resolveMediaUrl(player.avatarUrl) || null} name={playerName(player)} size={32} />}
            title={<Link className="gk-dt-primary__title" to={`/profile/${player.userId}`}>{playerName(player)}</Link>} subtitle={player.username ? `@${player.username}` : undefined} /> },
        { id: 'position', label: copy('sort3', 'Position'), width: 'minmax(110px, 1fr)', sortable: true, render: player => player.position ? squadLabel(player.position, t) : EMPTY_CELL },
        { id: 'number', label: copy('numberShort', 'No.'), width: '56px', sortable: true, render: player => player.jerseyNumber != null ? <span className="gk-num">{player.jerseyNumber}</span> : EMPTY_CELL },
        { id: 'status', label: copy('sort1', 'Status'), width: 'minmax(130px, 1.1fr)', sortable: true, render: player => <PlayerStatus player={player} now={now} /> },
        { id: 'consent', label: copy('parentConsent', 'Parent consent'), width: 'minmax(150px, 1.2fr)', sortable: true, render: player => <PlayerConsent player={player} needed={playerChoices(player, actions, managed(player)).consentToSend} /> },
        ...(shown.some(player => player.status === 'TRIALIST') ? [{ id: 'trialEnds', label: t('trialists.trialEnds'), narrowLabel: t('trialists.trialEnds'), width: '110px', sortable: true, render: (player: ClubPlayerAffiliation) => {
            const days = player.status === 'TRIALIST' ? daysFromToday(player.trialEndsOn, now) : null;
            return days === null ? EMPTY_CELL : <span className={days < 0 ? 'gk-dt-date--late' : days <= 3 ? 'gk-dt-date--soon' : undefined}>{formatDate(player.trialEndsOn!, { day: 'numeric', month: 'short' })}</span>;
        } }] : []),
        { id: 'joined', label: copy('sort6', 'Joined'), narrowLabel: copy('sort6', 'Joined'), width: '110px', sortable: true, render: player => shortDate(player.joinedAt) ?? EMPTY_CELL },
    ];

    let body;
    if (p.playerLoading && !directory) body = <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('loading', 'Loading players')}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={52} />)}</div></Panel>;
    else if (p.playerError && !directory) body = <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{p.playerError}</span><Button size="sm" onClick={p.onRetry}>{copy('retry', 'Try again')}</Button></div>;
    else if (!shown.length) body = <Panel><EmptyNote title={query ? copy('noMatches', 'No matches') : copy('emptyTitle', 'No players yet')}
        action={query ? <Button size="sm" onClick={() => setQuery('')}>{copy('clearSearch', 'Clear search')}</Button> : undefined}>
        {query ? copy('noMatchesHint', 'Try a different search term.') : p.playerStatusFilter === 'TRIALIST' ? t('trialists.emptyOnTrial') : copy('emptyHint', 'Players appear here when they join your club or are invited.')}</EmptyNote></Panel>;
    else body = <DataTable label={statusLabel(p.playerStatusFilter)} columns={columns} rows={shown} rowKey={player => `${player.userId}-${player.status}`} sort={sort}
        onSort={by => { const value = nextSort(sort, by); setParam({ sort: value?.by ?? null, dir: value?.descending ? 'desc' : null }); }}
        actions={player => <PlayerActions player={player} actions={actions} admissionManaged={managed(player)} />}
        details={player => playerChoices(player, actions, managed(player)).hasDetails ? <PlayerDetails player={player} actions={actions} admissionManaged={managed(player)} /> : null}
        footer={paged ? <>
            <span>{copy('page', 'Page {{page}} of {{total}}', { page: directory.pageNumber + 1, total: p.totalPlayerPages })}</span>
            <span className="gk-row"><Button size="sm" disabled={directory.pageNumber === 0} onClick={() => changePage(Math.max(0, directory.pageNumber - 1))}>{copy('previous', 'Previous')}</Button>
                <Button size="sm" disabled={directory.pageNumber + 1 >= p.totalPlayerPages} onClick={() => changePage(directory.pageNumber + 1)}>{copy('next', 'Next')}</Button></span>
        </> : undefined} />;

    return <PageFrame className="cw-page pl-page" aria-busy={p.playerLoading}>
        <PageHeader title={copy('title', 'Players')} subtitle={copy('subtitle', 'Status, trial dates and parent consent for everyone who plays for the club.')}
            actions={<>
                <Button variant="ghost" onClick={() => p.onTabChange('squads')}>{copy('squads', 'Manage squads')}</Button>
                <Button variant="ghost" onClick={() => p.onTabChange('player-cards')}>{copy('cards', 'Player cards')}</Button>
                <Button variant="primary" disabled={!canInvite} aria-describedby={!canInvite && p.joiningUnavailableReason ? reasonId : undefined} onClick={() => p.onTabChange('admissions')}><UserPlus aria-hidden="true" />{copy('invite', 'Invite player')}</Button>
            </>} />
        <div className="gk-stack">
            {!canInvite && p.joiningUnavailableReason && <p id={reasonId} role="status" className="gk-notice">{p.joiningUnavailableReason}</p>}
            <div className="gk-stack gk-stack--tight">
                <ViewTabs label={copy('filter', 'Filter players by status')} value={p.playerStatusFilter} onChange={status => { setQuery(''); p.onStatusFilterChange(status as Filter); }}
                    views={FILTERS.map(status => ({ id: status, label: statusLabel(status), count: counts[status] ?? 0 }))} />
                <ListToolbar count={copy('shown', '{{count}} shown', { count: shown.length })} onClear={query ? () => setQuery('') : undefined}>
                    <SearchInput value={query} onChange={event => setQuery(event.target.value)} aria-label={copy('search', 'Search players on this page')} placeholder={copy('search', 'Search players on this page')} />
                </ListToolbar>
            </div>
            {p.playerError && directory && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{p.playerError}</span><Button size="sm" onClick={p.onRetry}>{copy('retry', 'Try again')}</Button></div>}
            {body}
        </div>
    </PageFrame>;
}
