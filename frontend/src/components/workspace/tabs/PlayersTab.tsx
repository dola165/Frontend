import { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, Check, MessageSquare, Search, UserPlus, UserX, Users, X } from 'lucide-react';
import type { ClubPlayerAffiliation, PlayerAffiliationStatus, PageResult } from '../../../features/clubs/domain';
import { ErrorBlock, formatMetaTime, PageSpinner, Pill } from '../helpers';
import type { SortState } from '../helpers';
import { EmptyStateCard } from '../EmptyStateCard';
import { UserIdentityCell } from '../UserIdentityCell';
import { StatusCell } from '../StatusCell';
import { OverflowActions, type OverflowActionItem } from '../../ui/OverflowActions';
import { TrialistBadge } from '../TrialistBadge';
import type { WorkspaceTab } from '../types';
import { squadLabel } from '../../squads/squadLabels';
import '../../squads/squad-design.css';
import './players-roster.css';

interface PlayersTabProps {
    playerDirectory: PageResult<ClubPlayerAffiliation> | null;
    playerLoading: boolean;
    playerError: string | null;
    playerStatusFilter: 'ALL' | PlayerAffiliationStatus;
    playerCounts?: Partial<Record<'ALL' | PlayerAffiliationStatus, number>>;
    pendingKey: string | null;
    canManagePlayerStatuses: boolean;
    canInvitePlayer?: boolean;
    joiningUnavailableReason?: string;
    totalPlayerPages: number;
    onStatusFilterChange: (filter: 'ALL' | PlayerAffiliationStatus) => void;
    onPlayerStatusChange: (userId: number, status: PlayerAffiliationStatus, playerName?: string) => Promise<void>;
    onReviewJoining?: (userId: number) => void;
    joiningPlayerIds?: readonly number[];
    onTrialEndsChange: (userId: number, trialEndsOn: string) => Promise<void>;
    onRetry: () => void;
    onPageChange: (page: number) => void;
    onMessagePlayer?: (userId: number, playerName?: string) => void;
    onSendConsentEmail?: (userId: number, parentEmail?: string | null) => Promise<boolean> | void;
    onTabChange: (tab: WorkspaceTab) => void;
}

// ── helpers ──

const EMPTY_PLAYERS: ClubPlayerAffiliation[] = [];
const FILTERS = ['ALL', 'TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'] as const;
type PlayerFilter = (typeof FILTERS)[number];

// ── component ──

export const PlayersTab = ({
    playerDirectory,
    playerLoading,
    playerError,
    playerStatusFilter,
    playerCounts,
    pendingKey,
    canManagePlayerStatuses,
    canInvitePlayer = true,
    joiningUnavailableReason,
    totalPlayerPages,
    onStatusFilterChange,
    onPlayerStatusChange,
    onReviewJoining,
    joiningPlayerIds,
    onTrialEndsChange,
    onRetry,
    onPageChange,
    onMessagePlayer,
    onSendConsentEmail,
    onTabChange,
}: PlayersTabProps) => {
    const { t } = useTranslation();
    const joiningReasonId = useId();
    const allPlayers = playerDirectory?.content ?? EMPTY_PLAYERS;
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState<SortState | null>(null);
    // Phase A5 — inline parent-email capture for trialist consent sends.
    const [consentEmailFor, setConsentEmailFor] = useState<number | null>(null);
    const [consentEmailValue, setConsentEmailValue] = useState('');

    // Counts must represent the whole affiliation set, not just the current
    // paginated page. Fall back to the page while the overview is unavailable.
    const counts = useMemo(() => {
        const fallback: Record<PlayerFilter, number> = {
            ALL: allPlayers.length,
            TRIALIST: allPlayers.filter((p) => p.status === 'TRIALIST').length,
            ACTIVE: allPlayers.filter((p) => p.status === 'ACTIVE').length,
            PAST: allPlayers.filter((p) => p.status === 'PAST').length,
            REMOVED: allPlayers.filter((p) => p.status === 'REMOVED').length,
        };
        const map = {} as Record<PlayerFilter, number>;
        for (const status of FILTERS) {
            const value = playerCounts?.[status];
            map[status] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback[status];
        }
        if (!Number.isFinite(playerCounts?.ALL)) map.ALL = FILTERS.filter(status => status !== 'ALL').reduce((total, status) => total + map[status], 0);
        return map;
    }, [allPlayers, playerCounts]);

    // client-side search
    const filteredPlayers = useMemo(() => {
        if (!searchQuery.trim()) return allPlayers;
        const q = searchQuery.toLowerCase();
        return allPlayers.filter(
            (p) => (p.fullName || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q),
        );
    }, [allPlayers, searchQuery]);

    const getPlayerSortValue = (p: ClubPlayerAffiliation, col: number): string | number | null => {
        switch (col) {
            case 0:
                return (p.fullName || p.username || '').toLowerCase();
            case 1:
                return p.status;
            case 2:
                return p.parentalConsentStatus ?? '';
            case 3:
                return p.position || '';
            case 4:
                return p.jerseyNumber ?? -1;
            case 5:
                return p.trialEndsOn ?? '';
            case 6:
                return p.joinedAt ?? '';
            default:
                return null;
        }
    };

    const handleSort = useCallback((col: number) => {
        setSort((prev) =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' },
        );
    }, []);

    const sortedPlayers = useMemo(() => {
        if (!sort) return filteredPlayers;
        try {
            const data = [...filteredPlayers];
            data.sort((a, b) => {
                const aVal = getPlayerSortValue(a, sort.column);
                const bVal = getPlayerSortValue(b, sort.column);
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
                const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return sort.direction === 'desc' ? -cmp : cmp;
            });
            return data;
        } catch {
            return filteredPlayers;
        }
    }, [filteredPlayers, sort]);

    const trialistCount = counts.TRIALIST || 0;

    // ── render ──

    return (
        <div className="squad-design players-roster" aria-busy={playerLoading}>
            <header className="sd-heading">
                <div>
                    <span className="sd-eyebrow">{t('squadDesign.players.eyebrow', 'Club workspace / People')}</span>
                    <h1>{t('squadDesign.players.title', 'Players')}</h1>
                    <p>
                        {t(
                            'squadDesign.players.description',
                            'Your players, their progress and the next decision. All in one place.',
                        )}
                    </p>
                </div>
                <button type="button" disabled={!canInvitePlayer} aria-describedby={!canInvitePlayer && joiningUnavailableReason ? joiningReasonId : undefined} onClick={() => onTabChange('admissions')} className="sd-primary">
                    <UserPlus size={16} />
                    {t('squadDesign.players.invite', 'Invite player')}
                </button>
            </header>
            {!canInvitePlayer && joiningUnavailableReason && <p id={joiningReasonId} role="status">{joiningUnavailableReason}</p>}
            <div className="players-roster-links">
                <button type="button" onClick={() => onTabChange('squads')}>
                    {t('squadDesign.players.squads', 'Manage squads')} <ArrowDown size={13} className="-rotate-90" />
                </button>
                <button type="button" onClick={() => onTabChange('player-cards')}>
                    {t('squadDesign.players.cards', 'Player cards')} <ArrowDown size={13} className="-rotate-90" />
                </button>
            </div>
            <div
                className="players-status-filters"
                aria-label={t('squadDesign.players.filter', 'Filter players by status')}
            >
                {FILTERS.map((status) => (
                    <button
                        key={status}
                        data-player-status={status}
                        type="button"
                        aria-pressed={playerStatusFilter === status}
                        onClick={() => {
                            setSearchQuery('');
                            onStatusFilterChange(status);
                        }}
                    >
                        {t(`squadDesign.players.status.${status}`, {
                            defaultValue:
                                status === 'ALL'
                                    ? 'All players'
                                    : status === 'TRIALIST'
                                      ? 'On trial'
                                      : status.charAt(0) + status.slice(1).toLowerCase(),
                        })}
                        <span>{counts[status] ?? 0}</span>
                    </button>
                ))}
            </div>
            <div className="sd-toolbar">
                <label className="sd-search">
                    <Search size={16} />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label={t('squadDesign.players.search', 'Search players on this page')}
                        placeholder={t('squadDesign.players.search', 'Search players on this page')}
                    />
                </label>
                <label className="players-sort">
                    <span>{t('squadDesign.players.sort', 'Sort by')}</span>
                    <select
                        value={sort?.column ?? ''}
                        onChange={(e) =>
                            setSort(e.target.value === '' ? null : { column: Number(e.target.value), direction: 'asc' })
                        }
                    >
                        <option value="">{t('squadDesign.players.defaultOrder', 'Default order')}</option>
                        {['Player', 'Status', 'Consent', 'Position', 'Shirt number', 'Trial ends', 'Joined'].map(
                            (label, col) => (
                                <option key={col} value={col}>
                                    {t(`squadDesign.players.sort${col}`, label)}
                                </option>
                            ),
                        )}
                    </select>
                    {sort && (
                        <button
                            type="button"
                            className="sd-icon-button"
                            onClick={() => handleSort(sort.column)}
                            aria-label={t('squadDesign.players.reverseSort', 'Reverse sort order')}
                        >
                            <ArrowDown size={14} className={sort.direction === 'desc' ? 'rotate-180' : ''} />
                        </button>
                    )}
                </label>
            </div>
            {trialistCount > 0 && playerStatusFilter === 'TRIALIST' && (
                <div className="players-trial-note">
                    <Users size={16} />
                    <span>
                        {t(
                            'squadDesign.players.trialNote',
                            'Review trial dates and consent before moving a player into the active squad.',
                        )}
                    </span>
                </div>
            )}
            {playerError && playerDirectory && <ErrorBlock message={playerError} onRetry={onRetry} />}
            {/* Content */}
            {playerLoading && !playerDirectory ? (
                <PageSpinner />
            ) : playerError && !playerDirectory ? (
                <ErrorBlock message={playerError} onRetry={onRetry} />
            ) : sortedPlayers.length === 0 ? (
                <EmptyStateCard
                    icon={Users}
                    title={searchQuery ? 'No matches' : 'No players yet'}
                    description={
                        searchQuery
                            ? 'Try a different search term.'
                            : playerStatusFilter === 'TRIALIST'
                              ? t('trialists.emptyOnTrial')
                              : 'Players will appear here when they join your club or are invited.'
                    }
                />
            ) : (
                <>
                    {/* Column header */}
                    <div className="players-table-head players-table-grid">
                        {[
                            { col: 0, label: t('squadDesign.players.sort0', 'Player'), className: '' },
                            { col: 1, label: t('squadDesign.players.sort1', 'Status'), className: '' },
                            { col: 2, label: t('squadDesign.players.sort2', 'Consent'), className: '' },
                            { col: 3, label: t('squadDesign.players.sort3', 'Position'), className: '' },
                            { col: 4, label: t('squadDesign.roster.number', 'No.'), className: '' },
                            { col: 5, label: t('trialists.trialEnds').toUpperCase(), className: '' },
                            { col: 6, label: t('squadDesign.players.sort6', 'Joined'), className: '' },
                        ].map(({ col, label, className }) => (
                            <button
                                key={col}
                                type="button"
                                onClick={() => handleSort(col)}
                                className={`inline-flex items-center gap-1 hover:text-[var(--fc-text-primary)] transition-colors ${className}`}
                            >
                                {label}
                                <span className="text-[10px] leading-none">
                                    {sort?.column === col ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                </span>
                            </button>
                        ))}
                        <span />
                    </div>

                    {/* Card rows */}
                    <div className="players-table-body">
                        {sortedPlayers.map((player) => {
                            const isTrialist = player.status === 'TRIALIST';
                            const isInactive = player.status === 'PAST' || player.status === 'REMOVED';
                            const isCurrent = player.status === 'ACTIVE' || player.status === 'TRIALIST';
                            const isAdmissionManaged = joiningPlayerIds?.includes(player.userId) === true;
                            // Phase A5 — consent attaches at first contact: offer the
                            // send affordance on trialist rows too.
                            const consentNeedsSending =
                                isCurrent &&
                                !!player.requiresParentalConsent &&
                                (!player.parentalConsentStatus || player.parentalConsentStatus === 'NOT_REQUIRED') &&
                                !!onSendConsentEmail;
                            const statusTone =
                                player.status === 'ACTIVE'
                                    ? 'success'
                                    : player.status === 'TRIALIST'
                                      ? 'warning'
                                      : player.status === 'PAST'
                                        ? 'warning'
                                        : 'neutral';
                            // POS and jersey from API
                            const pos = player.position;
                            const jersey = player.jerseyNumber;

                            return (
                                <div
                                    key={`${player.userId}-${player.status}`}
                                    className="players-table-row players-table-grid group"
                                    data-status={player.status}
                                >
                                    {/* Player identity */}
                                    <span className="players-identity">
                                        <UserIdentityCell
                                            avatarUrl={player.avatarUrl}
                                            fullName={player.fullName}
                                            username={player.username}
                                            userId={player.userId}
                                        />
                                    </span>

                                    {/* Status */}
                                    <span
                                        className="players-cell"
                                        data-label={t('squadDesign.players.sort1', 'Status')}
                                    >
                                        <StatusCell label={player.status.replace('_', ' ')} tone={statusTone} />
                                        {isTrialist && <TrialistBadge joinedAt={player.joinedAt} className="players-trial-age" />}
                                    </span>

                                    {/* Parental consent (13-15, WEB_APP_MASTER_PLAN.md §2.1; phase A5 covers trialists) */}
                                    <span
                                        className="players-cell players-consent"
                                        data-label={t('squadDesign.players.sort2', 'Consent')}
                                    >
                                        {isAdmissionManaged && onReviewJoining ? (
                                            <button type="button" className="text-xs text-[var(--fc-accent)] hover:underline" onClick={() => onReviewJoining(player.userId)}>View agreed terms</button>
                                        ) : player.parentalConsentStatus === 'CONFIRMED' ? (
                                            <Pill label={t('minors.playersTab.consentParent')} tone="success" />
                                        ) : player.parentalConsentStatus === 'DECLINED' ? (
                                            <>
                                                <Pill label={t('minors.playersTab.consentDeclined')} tone="danger" />
                                                {player.parentEmail && isCurrent && onSendConsentEmail && (
                                                    <button
                                                        type="button"
                                                        disabled={pendingKey === `consent-${player.userId}`}
                                                        title={t('minors.playersTab.resendTo', {
                                                            email: player.parentEmail,
                                                        })}
                                                        onClick={() =>
                                                            onSendConsentEmail(player.userId, player.parentEmail)
                                                        }
                                                        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] hover:underline"
                                                    >
                                                        {t('minors.playersTab.resend')}
                                                    </button>
                                                )}
                                            </>
                                        ) : player.parentalConsentStatus === 'PENDING' ||
                                          player.parentalConsentStatus === 'EXPIRED' ? (
                                            <>
                                                <Pill
                                                    label={t(
                                                        player.parentalConsentStatus === 'EXPIRED'
                                                            ? 'minors.playersTab.consentExpired'
                                                            : 'minors.playersTab.consentPending',
                                                    )}
                                                    tone="warning"
                                                />
                                                {player.parentEmail && isCurrent && onSendConsentEmail && (
                                                    <button
                                                        type="button"
                                                        disabled={pendingKey === `consent-${player.userId}`}
                                                        title={t('minors.playersTab.resendTo', {
                                                            email: player.parentEmail,
                                                        })}
                                                        onClick={() =>
                                                            onSendConsentEmail(player.userId, player.parentEmail)
                                                        }
                                                        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] hover:underline"
                                                    >
                                                        {t('minors.playersTab.resend')}
                                                    </button>
                                                )}
                                            </>
                                        ) : consentNeedsSending && consentEmailFor !== player.userId ? (
                                            <button
                                                type="button"
                                                disabled={pendingKey === `consent-${player.userId}`}
                                                onClick={() => {
                                                    if (player.parentEmail) {
                                                        void onSendConsentEmail?.(player.userId, player.parentEmail);
                                                    } else {
                                                        setConsentEmailFor(player.userId);
                                                        setConsentEmailValue('');
                                                    }
                                                }}
                                                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] hover:underline"
                                            >
                                                {t('minors.playersTab.sendConsent')}
                                            </button>
                                        ) : consentEmailFor === player.userId ? (
                                            <span className="flex items-center gap-1">
                                                <input
                                                    type="email"
                                                    value={consentEmailValue}
                                                    onChange={(e) => setConsentEmailValue(e.target.value)}
                                                    placeholder={t('minors.playersTab.parentEmailPlaceholder')}
                                                    aria-label={`${t('minors.playersTab.parentEmailPlaceholder')} ${player.fullName || player.username}`}
                                                    className="w-28 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-1.5 py-0.5 text-[11px] text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)]"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={
                                                        !consentEmailValue.trim() ||
                                                        pendingKey === `consent-${player.userId}`
                                                    }
                                                    onClick={async () => {
                                                        const sent = await onSendConsentEmail?.(
                                                            player.userId,
                                                            consentEmailValue.trim(),
                                                        );
                                                        if (sent !== false) {
                                                            setConsentEmailFor(null);
                                                            setConsentEmailValue('');
                                                        }
                                                    }}
                                                    className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] hover:underline disabled:opacity-50"
                                                >
                                                    {t('minors.playersTab.send')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConsentEmailFor(null)}
                                                    className="text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"
                                                    aria-label={t('minors.playersTab.cancelEmail')}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        )}
                                    </span>

                                    {/* POS */}
                                    <span
                                        className="players-cell"
                                        data-label={t('squadDesign.players.sort3', 'Position')}
                                    >
                                        {pos ? (
                                            <span className="players-position">{squadLabel(pos, t)}</span>
                                        ) : (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        )}
                                    </span>

                                    {/* Jersey # */}
                                    <span
                                        className="players-cell"
                                        data-label={t('squadDesign.players.sort4', 'Shirt number')}
                                    >
                                        {jersey ?? '—'}
                                    </span>

                                    {/* Trial ends (phase A1) — editable for trialists */}
                                    <span className="players-cell" data-label={t('trialists.trialEnds')}>
                                        {isTrialist ? (
                                            <input
                                                type="date"
                                                value={player.trialEndsOn ?? ''}
                                                onChange={(e) => void onTrialEndsChange(player.userId, e.target.value)}
                                                disabled={
                                                    !canManagePlayerStatuses || isAdmissionManaged ||
                                                    pendingKey === `trial-ends-${player.userId}`
                                                }
                                                aria-label={`${t('trialists.trialEnds')} ${player.fullName || player.username}`}
                                                title={
                                                    isAdmissionManaged
                                                        ? 'Review dates in the player’s joining arrangement.'
                                                        : canManagePlayerStatuses
                                                        ? undefined
                                                        : 'Only club owners and admins can change player status or trial dates.'
                                                }
                                                className="w-full rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1 text-xs text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                                            />
                                        ) : (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        )}
                                    </span>

                                    {/* Joined date */}
                                    <span
                                        className="players-cell"
                                        data-label={t('squadDesign.players.sort6', 'Joined')}
                                    >
                                        {formatMetaTime(player.joinedAt) || '—'}
                                    </span>

                                    {/* Actions */}
                                    <span className="players-row-actions">
                                        {isInactive ? (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        ) : isTrialist ? (
                                            <>
                                                {(onReviewJoining || canManagePlayerStatuses) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onReviewJoining ? onReviewJoining(player.userId) : onTabChange('admissions')}
                                                        className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-on-accent)] hover:opacity-90 transition-opacity"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Review joining
                                                    </button>
                                                )}
                                                {canManagePlayerStatuses && !isAdmissionManaged ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={pendingKey === `player-${player.userId}-REMOVED`}
                                                            onClick={() =>
                                                                void onPlayerStatusChange(
                                                                    player.userId,
                                                                    'REMOVED',
                                                                    player.fullName || undefined,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--fc-state-danger)] px-2.5 py-1 text-xs font-semibold text-[var(--fc-state-danger)] hover:bg-[var(--fc-state-danger-soft)] disabled:opacity-50 transition-colors"
                                                        >
                                                            <X className="h-3 w-3" />
                                                            {t('trialists.release')}
                                                        </button>
                                                    </>
                                                ) : (
                                                    !onReviewJoining && <span
                                                        className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fc-text-muted)]"
                                                        title="Only club owners and admins can finalize player status."
                                                    >
                                                        Review only
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {isAdmissionManaged && onReviewJoining && <button type="button" className="inline-flex items-center gap-1 rounded-xl border border-[var(--fc-border)] px-2.5 py-1 text-xs font-semibold text-[var(--fc-text-primary)]" onClick={() => onReviewJoining(player.userId)}>Review placement</button>}
                                                {onMessagePlayer && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onMessagePlayer(player.userId, player.fullName || undefined)
                                                        }
                                                        aria-label={`Message ${player.fullName || player.username}`}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--fc-text-muted)] hover:text-[var(--fc-accent)] hover:bg-[var(--fc-accent-soft)] transition-colors"
                                                        title={`Message ${player.fullName || player.username}`}
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canManagePlayerStatuses && !isAdmissionManaged && (
                                                    <OverflowActions
                                                        triggerIcon="vertical"
                                                        label="Player actions"
                                                        items={(() => {
                                                            const items: OverflowActionItem[] = [];
                                                            const name = player.fullName || undefined;
                                                            if (player.status === 'ACTIVE') {
                                                                items.push({
                                                                    id: 'demote',
                                                                    label: 'Demote',
                                                                    description: 'Revert to trialist',
                                                                    icon: <ArrowDown className="h-3.5 w-3.5" />,
                                                                    disabled:
                                                                        pendingKey ===
                                                                        `player-${player.userId}-TRIALIST`,
                                                                    onSelect: () =>
                                                                        void onPlayerStatusChange(
                                                                            player.userId,
                                                                            'TRIALIST',
                                                                            name,
                                                                        ),
                                                                });
                                                                items.push({
                                                                    id: 'mark-past',
                                                                    label: 'Mark Past',
                                                                    description:
                                                                        'Move to past players, remove from squads',
                                                                    icon: <ArrowLeft className="h-3.5 w-3.5" />,
                                                                    tone: 'warning',
                                                                    disabled:
                                                                        pendingKey === `player-${player.userId}-PAST`,
                                                                    confirm: {
                                                                        title: 'Mark as past?',
                                                                        body: `Mark "${player.fullName || player.username}" as a past player? They will be removed from ALL squads.`,
                                                                    },
                                                                    onSelect: () =>
                                                                        void onPlayerStatusChange(
                                                                            player.userId,
                                                                            'PAST',
                                                                            name,
                                                                        ),
                                                                });
                                                                items.push({
                                                                    id: 'remove',
                                                                    label: 'Remove',
                                                                    description: 'Remove from club permanently',
                                                                    icon: <UserX className="h-3.5 w-3.5" />,
                                                                    tone: 'danger',
                                                                    divider: true,
                                                                    disabled:
                                                                        pendingKey ===
                                                                        `player-${player.userId}-REMOVED`,
                                                                    confirm: {
                                                                        title: 'Remove player?',
                                                                        body: `Remove "${player.fullName || player.username}" from the club? They will be removed from ALL squads.`,
                                                                    },
                                                                    onSelect: () =>
                                                                        void onPlayerStatusChange(
                                                                            player.userId,
                                                                            'REMOVED',
                                                                            name,
                                                                        ),
                                                                });
                                                            }
                                                            return items;
                                                        })()}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {playerDirectory && playerDirectory.totalElements > playerDirectory.pageSize && (
                        <div className="players-pagination">
                            <p className="text-xs text-[var(--fc-text-muted)]">
                                Page {playerDirectory.pageNumber + 1} of {totalPlayerPages}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        onPageChange(Math.max(0, playerDirectory.pageNumber - 1));
                                    }}
                                    disabled={playerDirectory.pageNumber === 0}
                                    className="rounded-xl border border-[var(--fc-border)] px-2.5 py-1 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        onPageChange(playerDirectory.pageNumber + 1);
                                    }}
                                    disabled={playerDirectory.pageNumber + 1 >= totalPlayerPages}
                                    className="rounded-xl border border-[var(--fc-border)] px-2.5 py-1 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
