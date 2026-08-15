import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, Check, MessageSquare, Search, UserPlus, UserX, Users, X } from 'lucide-react';
import type { ClubPlayerAffiliation, PlayerAffiliationStatus, PageResult } from '../../../features/clubs/domain';
import { ErrorBlock, formatMetaTime, PageSpinner, SectionHeader, Pill } from '../helpers';
import type { SortState } from '../helpers';
import { EmptyStateCard } from '../EmptyStateCard';
import { UserIdentityCell } from '../UserIdentityCell';
import { StatusCell } from '../StatusCell';
import { OverflowActions, type OverflowActionItem } from '../../ui/OverflowActions';
import { TrialistBadge } from '../TrialistBadge';
import type { WorkspaceTab } from '../types';

interface PlayersTabProps {
    playerDirectory: PageResult<ClubPlayerAffiliation> | null;
    playerLoading: boolean;
    playerError: string | null;
    playerStatusFilter: 'ALL' | PlayerAffiliationStatus;
    pendingKey: string | null;
    totalPlayerPages: number;
    onStatusFilterChange: (filter: 'ALL' | PlayerAffiliationStatus) => void;
    onPlayerStatusChange: (userId: number, status: PlayerAffiliationStatus, playerName?: string) => Promise<void>;
    onRetry: () => void;
    onPageChange: (page: number) => void;
    onMessagePlayer?: (userId: number, playerName?: string) => void;
    onSendConsentEmail?: (userId: number, parentEmail?: string | null) => void;
    onTabChange: (tab: WorkspaceTab) => void;
}

// ── helpers ──

const posTone = (pos?: string | null): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
    if (!pos) return 'neutral';
    const p = pos.toUpperCase();
    if (p === 'GK' || p === 'GOALKEEPER') return 'success';
    if (p === 'DEF' || p === 'DEFENDER' || p === 'CB' || p === 'LB' || p === 'RB' || p === 'SW') return 'info';
    if (p === 'MID' || p === 'MIDFIELDER' || p === 'CM' || p === 'CDM' || p === 'CAM' || p === 'LM' || p === 'RM') return 'warning';
    if (p === 'FWD' || p === 'FORWARD' || p === 'ST' || p === 'CF' || p === 'LW' || p === 'RW' || p === 'WINGER') return 'danger';
    return 'neutral';
};

const FILTERS = ['ALL', 'TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'] as const;

// ── component ──

export const PlayersTab = ({
    playerDirectory, playerLoading, playerError, playerStatusFilter,
    pendingKey, totalPlayerPages, onStatusFilterChange, onPlayerStatusChange, onRetry, onPageChange,
    onMessagePlayer, onSendConsentEmail, onTabChange,
}: PlayersTabProps) => {
    const { t } = useTranslation();
    const allPlayers = playerDirectory?.content ?? [];
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState<SortState | null>(null);

    // counts per filter
    const counts = useMemo(() => {
        const map: Record<string, number> = { ALL: allPlayers.length };
        for (const s of FILTERS) {
            if (s === 'ALL') continue;
            map[s] = allPlayers.filter((p) => p.status === s).length;
        }
        return map;
    }, [allPlayers]);

    // client-side search
    const filteredPlayers = useMemo(() => {
        if (!searchQuery.trim()) return allPlayers;
        const q = searchQuery.toLowerCase();
        return allPlayers.filter(
            (p) =>
                (p.fullName || '').toLowerCase().includes(q) ||
                (p.username || '').toLowerCase().includes(q),
        );
    }, [allPlayers, searchQuery]);

    const getPlayerSortValue = (p: ClubPlayerAffiliation, col: number): string | number | null => {
        switch (col) {
            case 0: return (p.fullName || p.username || '').toLowerCase();
            case 1: return p.status;
            case 2: return p.position || '';
            case 3: return p.jerseyNumber ?? -1;
            case 4: return p.joinedAt ?? '';
            default: return null;
        }
    };

    const handleSort = useCallback((col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
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
        <div className="space-y-4">
            <SectionHeader
                eyebrow="Players"
                title="Player Affiliations"
                description="Track trialists, active players, past players, and removed affiliations."
                action={
                    <button
                        type="button"
                        onClick={() => onTabChange('invites')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        + Invite Player
                    </button>
                }
            />

            {/* Filter row + search */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map((status) => {
                        const isActive = playerStatusFilter === status;
                        const count = counts[status] ?? 0;
                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => onStatusFilterChange(status)}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    isActive
                                        ? 'bg-[var(--fc-accent-soft)] border-[var(--fc-accent-border)] text-[var(--fc-accent)]'
                                        : 'border-[var(--fc-border)] bg-[var(--fc-card-bg)] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]'
                                }`}
                            >
                                {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                                <span className="ml-1 opacity-60">({count})</span>
                            </button>
                        );
                    })}
                </div>
                <div className="relative ml-auto w-full sm:w-56">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fc-text-muted)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or handle..."
                        className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] py-2 pl-9 pr-3 text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)] focus:ring-1 focus:ring-[var(--fc-accent)]"
                    />
                </div>
            </div>

            {/* Alert banner */}
            {trialistCount > 0 && (
                <div className="rounded-xl border border-[var(--fc-state-warning-soft)] bg-[var(--fc-state-warning-soft)] px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm text-[var(--fc-text-primary)]">
                        <strong>{trialistCount}</strong> player{trialistCount !== 1 ? 's are' : ' is'} waiting for a decision.
                    </span>
                    <button
                        type="button"
                        onClick={() => onStatusFilterChange('TRIALIST')}
                        className="text-sm font-medium text-[var(--fc-accent)] hover:underline"
                    >
                        Review
                    </button>
                </div>
            )}

            {/* Content */}
            {playerLoading && !playerDirectory ? (
                <PageSpinner />
            ) : playerError && !playerDirectory ? (
                <ErrorBlock message={playerError} onRetry={onRetry} />
            ) : sortedPlayers.length === 0 ? (
                <EmptyStateCard
                    icon={Users}
                    title={searchQuery ? 'No matches' : 'No players yet'}
                    description={searchQuery ? 'Try a different search term.' : 'Players will appear here when they join your club or are invited.'}
                />
            ) : (
                <>
                    {/* Column header */}
                    <div className="flex items-center gap-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 h-11 text-xs font-semibold text-[var(--fc-text-secondary)]">
                        {[
                            { col: 0, label: 'PLAYER', className: 'flex-1 min-w-0' },
                            { col: 1, label: 'STATUS', className: 'w-24' },
                            { col: 2, label: 'CONSENT', className: 'w-36' },
                            { col: 3, label: 'POS', className: 'w-20' },
                            { col: 4, label: '#', className: 'w-14' },
                            { col: 5, label: 'JOINED', className: 'w-32' },
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
                        <span className="w-36" />
                    </div>

                    {/* Card rows */}
                    <div className="space-y-1.5">
                        {sortedPlayers.map((player) => {
                            const isTrialist = player.status === 'TRIALIST';
                            const isInactive = player.status === 'PAST' || player.status === 'REMOVED';
                            const statusTone =
                                player.status === 'ACTIVE' ? 'success'
                                : player.status === 'TRIALIST' ? 'warning'
                                : player.status === 'PAST' ? 'warning'
                                : 'neutral';
                            // POS and jersey from API
                            const pos = player.position;
                            const jersey = player.jerseyNumber;

                            return (
                                <div
                                    key={`${player.userId}-${player.status}`}
                                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors group ${
                                        isTrialist
                                            ? 'bg-[var(--fc-state-warning-soft)] border-[var(--fc-state-warning-soft)]'
                                            : 'bg-[var(--fc-card-bg)] border-[var(--fc-border)] hover:bg-[var(--fc-surface-hover)]'
                                    }`}
                                >
                                    {/* Player identity */}
                                    <span className="flex-1 min-w-0 flex items-center gap-2">
                                        <UserIdentityCell
                                            avatarUrl={player.avatarUrl}
                                            fullName={player.fullName}
                                            username={player.username}
                                            userId={player.userId}
                                        />
                                        {isTrialist && (
                                            <TrialistBadge
                                                joinedAt={player.joinedAt}
                                                onApprove={() => onPlayerStatusChange(player.userId, 'ACTIVE', player.fullName || undefined)}
                                                onRelease={() => onPlayerStatusChange(player.userId, 'REMOVED', player.fullName || undefined)}
                                            />
                                        )}
                                    </span>

                                    {/* Status */}
                                    <span className="w-24">
                                        <StatusCell label={player.status.replace('_', ' ')} tone={statusTone} />
                                    </span>

                                    {/* Parental consent (13-15, WEB_APP_MASTER_PLAN.md §2.1) */}
                                    <span className="w-36 flex items-center gap-1">
                                        {player.parentalConsentStatus === 'CONFIRMED' ? (
                                            <Pill label={t('minors.playersTab.consentParent')} tone="success" />
                                        ) : player.parentalConsentStatus === 'DECLINED' ? (
                                            <>
                                                <Pill label={t('minors.playersTab.consentDeclined')} tone="danger" />
                                                {player.status === 'ACTIVE' && onSendConsentEmail && (
                                                    <button
                                                        type="button"
                                                        title={t('minors.playersTab.resendTo', { email: player.parentEmail ?? 'parent' })}
                                                        onClick={() => onSendConsentEmail(player.userId, player.parentEmail)}
                                                        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#16a34a] hover:underline"
                                                    >
                                                        {t('minors.playersTab.resend')}
                                                    </button>
                                                )}
                                            </>
                                        ) : player.parentalConsentStatus === 'PENDING' ? (
                                            <>
                                                <Pill label={t('minors.playersTab.consentPending')} tone="warning" />
                                                {player.status === 'ACTIVE' && onSendConsentEmail && (
                                                    <button
                                                        type="button"
                                                        title={t('minors.playersTab.resendTo', { email: player.parentEmail ?? 'parent' })}
                                                        onClick={() => onSendConsentEmail(player.userId, player.parentEmail)}
                                                        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#16a34a] hover:underline"
                                                    >
                                                        {t('minors.playersTab.resend')}
                                                    </button>
                                                )}
                                            </>
                                        ) : player.parentEmail && player.status === 'ACTIVE' && onSendConsentEmail ? (
                                            <button
                                                type="button"
                                                title={t('minors.playersTab.sendTo', { email: player.parentEmail })}
                                                onClick={() => onSendConsentEmail(player.userId, player.parentEmail)}
                                                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#16a34a] hover:underline"
                                            >
                                                {t('minors.playersTab.sendConsent')}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        )}
                                    </span>

                                    {/* POS */}
                                    <span className="w-20">
                                        {pos ? (
                                            <Pill label={pos.toUpperCase()} tone={posTone(pos)} />
                                        ) : (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        )}
                                    </span>

                                    {/* Jersey # */}
                                    <span className="w-14 text-xs text-[var(--fc-text-secondary)]">
                                        {jersey ?? '—'}
                                    </span>

                                    {/* Joined date */}
                                    <span className="w-32 text-xs text-[var(--fc-text-secondary)]">
                                        {formatMetaTime(player.joinedAt) || '—'}
                                    </span>

                                    {/* Actions */}
                                    <span className="w-36 flex items-center gap-1 justify-end">
                                        {isInactive ? (
                                            <span className="text-xs text-[var(--fc-text-muted)]">—</span>
                                        ) : isTrialist ? (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={pendingKey === `player-${player.userId}-ACTIVE`}
                                                    onClick={() => void onPlayerStatusChange(player.userId, 'ACTIVE', player.fullName || undefined)}
                                                    className="inline-flex items-center gap-1 rounded-xl bg-[#16a34a] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                                                >
                                                    <Check className="h-3 w-3" />
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={pendingKey === `player-${player.userId}-REMOVED`}
                                                    onClick={() => void onPlayerStatusChange(player.userId, 'REMOVED', player.fullName || undefined)}
                                                    className="inline-flex items-center gap-1 rounded-xl border border-[var(--fc-state-danger)] px-2.5 py-1 text-xs font-semibold text-[var(--fc-state-danger)] hover:bg-[var(--fc-state-danger-soft)] disabled:opacity-50 transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                    Decline
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {onMessagePlayer && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onMessagePlayer(player.userId, player.fullName || undefined)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--fc-text-muted)] hover:text-[var(--fc-accent)] hover:bg-[var(--fc-accent-soft)] opacity-0 group-hover:opacity-100 transition-all"
                                                        title={`Message ${player.fullName || player.username}`}
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </button>
                                                )}
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
                                                                disabled: pendingKey === `player-${player.userId}-TRIALIST`,
                                                                onSelect: () => void onPlayerStatusChange(player.userId, 'TRIALIST', name),
                                                            });
                                                            items.push({
                                                                id: 'mark-past',
                                                                label: 'Mark Past',
                                                                description: 'Move to past players, remove from squads',
                                                                icon: <ArrowLeft className="h-3.5 w-3.5" />,
                                                                tone: 'warning',
                                                                disabled: pendingKey === `player-${player.userId}-PAST`,
                                                                confirm: {
                                                                    title: 'Mark as past?',
                                                                    body: `Mark "${player.fullName || player.username}" as a past player? They will be removed from ALL squads.`,
                                                                },
                                                                onSelect: () => void onPlayerStatusChange(player.userId, 'PAST', name),
                                                            });
                                                            items.push({
                                                                id: 'remove',
                                                                label: 'Remove',
                                                                description: 'Remove from club permanently',
                                                                icon: <UserX className="h-3.5 w-3.5" />,
                                                                tone: 'danger',
                                                                divider: true,
                                                                disabled: pendingKey === `player-${player.userId}-REMOVED`,
                                                                confirm: {
                                                                    title: 'Remove player?',
                                                                    body: `Remove "${player.fullName || player.username}" from the club? They will be removed from ALL squads.`,
                                                                },
                                                                onSelect: () => void onPlayerStatusChange(player.userId, 'REMOVED', name),
                                                            });
                                                        }
                                                        return items;
                                                    })()}
                                                />
                                            </>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {playerDirectory && playerDirectory.totalElements > playerDirectory.pageSize && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-[var(--fc-text-muted)]">
                                Page {playerDirectory.pageNumber + 1} of {totalPlayerPages}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onPageChange(Math.max(0, playerDirectory.pageNumber - 1))}
                                    disabled={playerDirectory.pageNumber === 0}
                                    className="rounded-xl border border-[var(--fc-border)] px-2.5 py-1 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onPageChange(playerDirectory.pageNumber + 1)}
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
