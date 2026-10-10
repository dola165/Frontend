import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, UserPlus } from 'lucide-react';
import { Button, Chip, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import type { ClubPlayerAffiliation, PageResult, PlayerAffiliationStatus } from '../../clubs/domain';
import type { WorkspaceTab } from '../../../components/workspace/types';
import { useNow } from '../useNow';
import { PlayerRow } from './PlayerRow';
import '../club-workspace.css';
import '../../clubOperations/records/records.css';
import './players.css';

type Filter = 'ALL' | PlayerAffiliationStatus;
const FILTERS = ['ALL', 'TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'] as const;
const SORTS = ['name', 'status', 'consent', 'position', 'number', 'trialEnds', 'joined'] as const;
type Sort = typeof SORTS[number];
const EMPTY: ClubPlayerAffiliation[] = [];
const sortValue = (player: ClubPlayerAffiliation, sort: Sort): string | number => ({
    name: (player.fullName || player.username || '').toLowerCase(), status: player.status, consent: player.parentalConsentStatus ?? '',
    position: player.position ?? '', number: player.jerseyNumber ?? Number.MAX_SAFE_INTEGER, trialEnds: player.trialEndsOn ?? '9999', joined: player.joinedAt ?? '',
})[sort];

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
 * The club's players: filter by status (with whole-club counts), find someone on this page, and act on one row at a time.
 * Every action of the old table stays: joining review, release, trial dates, consent emails, status changes and messages.
 */
export function PlayersPage(p: PlayersPageProps) {
    const { t } = useTranslation();
    const reasonId = useId();
    const now = useNow();
    const players = p.playerDirectory?.content ?? EMPTY;
    const [query, setQuery] = useState(''), [sort, setSort] = useState<Sort | ''>(''), [descending, setDescending] = useState(false);
    const copy = (key: string, fallback: string, values?: Record<string, unknown>) => t(`squadDesign.players.${key}`, { defaultValue: fallback, ...values });
    const canInvite = p.canInvitePlayer ?? true;

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
        if (!sort) return found;
        const sign = descending ? -1 : 1;
        return [...found].sort((a, b) => { const x = sortValue(a, sort), y = sortValue(b, sort); return (x < y ? -1 : x > y ? 1 : 0) * sign; });
    }, [players, query, sort, descending]);
    const statusLabel = (status: Filter) => t(`squadDesign.players.status.${status}`, { defaultValue: status === 'ALL' ? 'All players' : status === 'TRIALIST' ? 'On trial' : status.charAt(0) + status.slice(1).toLowerCase() });
    const directory = p.playerDirectory;
    const paged = directory && directory.totalElements > directory.pageSize;
    const changePage = (page: number) => { setQuery(''); p.onPageChange(page); };
    const actions = {
        pendingKey: p.pendingKey, canManagePlayerStatuses: p.canManagePlayerStatuses, onPlayerStatusChange: p.onPlayerStatusChange, onTrialEndsChange: p.onTrialEndsChange,
        onReviewJoining: p.onReviewJoining, onOpenAdmissions: () => p.onTabChange('admissions'), onMessagePlayer: p.onMessagePlayer, onSendConsentEmail: p.onSendConsentEmail,
    };

    let body;
    if (p.playerLoading && !directory) body = <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('loading', 'Loading players')}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={52} />)}</div></Panel>;
    else if (p.playerError && !directory) body = <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{p.playerError}</span><Button size="sm" onClick={p.onRetry}>{copy('retry', 'Try again')}</Button></div>;
    else if (!shown.length) body = <Panel><EmptyNote title={query ? copy('noMatches', 'No matches') : copy('emptyTitle', 'No players yet')}
        action={query ? <Button size="sm" onClick={() => setQuery('')}>{copy('clearSearch', 'Clear search')}</Button> : undefined}>
        {query ? copy('noMatchesHint', 'Try a different search term.') : p.playerStatusFilter === 'TRIALIST' ? t('trialists.emptyOnTrial') : copy('emptyHint', 'Players appear here when they join your club or are invited.')}</EmptyNote></Panel>;
    else body = <Panel flush footer={paged ? <div className="pl-pager">
        <span className="gk-muted">{copy('page', 'Page {{page}} of {{total}}', { page: directory.pageNumber + 1, total: p.totalPlayerPages })}</span>
        <div className="gk-row"><Button size="sm" disabled={directory.pageNumber === 0} onClick={() => changePage(Math.max(0, directory.pageNumber - 1))}>{copy('previous', 'Previous')}</Button>
            <Button size="sm" disabled={directory.pageNumber + 1 >= p.totalPlayerPages} onClick={() => changePage(directory.pageNumber + 1)}>{copy('next', 'Next')}</Button></div>
    </div> : undefined}>
        <ul className="gk-list pl-list" aria-label={statusLabel(p.playerStatusFilter)}>{shown.map(player => <PlayerRow key={`${player.userId}-${player.status}`} player={player} now={now}
            admissionManaged={p.joiningPlayerIds?.includes(player.userId) === true} actions={actions} />)}</ul>
    </Panel>;

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
                <div className="gk-chips pl-filters" role="group" aria-label={copy('filter', 'Filter players by status')}>
                    {FILTERS.map(status => <Chip key={status} pressed={p.playerStatusFilter === status} onClick={() => { setQuery(''); p.onStatusFilterChange(status); }}>
                        {statusLabel(status)}<span className="gk-num gk-faint"> {counts[status] ?? 0}</span>
                    </Chip>)}
                </div>
                <div className="rec-toolbar">
                    <SearchInput className="rec-toolbar__search" value={query} onChange={event => setQuery(event.target.value)} aria-label={copy('search', 'Search players on this page')} placeholder={copy('search', 'Search players on this page')} />
                    <select className="gk-input" aria-label={copy('sort', 'Sort by')} value={sort} onChange={event => { setSort(event.target.value as Sort | ''); setDescending(false); }}>
                        <option value="">{copy('defaultOrder', 'Default order')}</option>
                        {SORTS.map((key, index) => <option key={key} value={key}>{copy(`sort${index}`, ['Player', 'Status', 'Consent', 'Position', 'Shirt number', 'Trial ends', 'Joined'][index])}</option>)}
                    </select>
                    {sort && <Button size="sm" variant="ghost" iconOnly aria-pressed={descending} aria-label={copy('reverseSort', 'Reverse sort order')} onClick={() => setDescending(value => !value)}><ArrowDownUp aria-hidden="true" /></Button>}
                    {p.playerStatusFilter === 'TRIALIST' && counts.TRIALIST > 0 && <span className="rec-toolbar__count">{copy('trialNote', 'Review trial dates and consent before moving a player into the active squad.')}</span>}
                </div>
            </div>
            {p.playerError && directory && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{p.playerError}</span><Button size="sm" onClick={p.onRetry}>{copy('retry', 'Try again')}</Button></div>}
            {body}
        </div>
    </PageFrame>;
}
