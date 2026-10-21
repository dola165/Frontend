import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Search, Send, User, X } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import {
    cancelTournamentInvitation,
    createTournamentInvitation,
    fetchTournamentInvitations,
    searchClubsForInvite,
    searchPlayersForInvite,
} from '../api';
import type { ClubSearchResult, TournamentInvitationDto, UserSearchResult } from '../domain';

interface Props {
    tournamentId: number;
}

const statusToneBorder: Record<string, string> = {
    PENDING: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30',
    ACCEPTED: 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/30',
    DECLINED: 'bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30',
    CANCELLED: 'bg-[var(--color-surface)] text-[var(--color-secondary)] border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]',
};

type SearchTarget = 'clubs' | 'players';

export const TournamentInvitationsPanel = ({ tournamentId }: Props) => {
    const [invitations, setInvitations] = useState<TournamentInvitationDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTarget, setSearchTarget] = useState<SearchTarget>('clubs');
    const [searchQuery, setSearchQuery] = useState('');
    const [clubResults, setClubResults] = useState<ClubSearchResult[]>([]);
    const [playerResults, setPlayerResults] = useState<UserSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [invitingId, setInvitingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const loadInvitations = useCallback(async () => {
        setLoading(true);
        try {
            setInvitations(await fetchTournamentInvitations(tournamentId));
        } catch {
            setInvitations([]);
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => { void loadInvitations(); }, [loadInvitations]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setClubResults([]);
            setPlayerResults([]);
            return;
        }
        let active = true;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                if (searchTarget === 'clubs') {
                    const results = await searchClubsForInvite(searchQuery);
                    if (active) setClubResults(results);
                } else {
                    const results = await searchPlayersForInvite(searchQuery);
                    if (active) setPlayerResults(results);
                }
            } catch {
                if (active) { setClubResults([]); setPlayerResults([]); }
            } finally {
                if (active) setSearching(false);
            }
        }, 300);
        return () => { active = false; clearTimeout(timer); };
    }, [searchQuery, searchTarget]);

    const handleInviteClub = async (clubId: number) => {
        setInvitingId(`club-${clubId}`);
        try {
            const inv = await createTournamentInvitation(tournamentId, { clubId });
            showMessage(`Invitation sent to ${inv.clubName ?? 'club'}.`, 'success');
            setSearchQuery('');
            setClubResults([]);
            void loadInvitations();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to send invitation.'), 'error');
        } finally {
            setInvitingId(null);
        }
    };

    const handleInvitePlayer = async (userId: number) => {
        setInvitingId(`player-${userId}`);
        try {
            await createTournamentInvitation(tournamentId, { userId, role: 'PLAYER' });
            showMessage('Player invitation sent.', 'success');
            setSearchQuery('');
            setPlayerResults([]);
            void loadInvitations();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to send invitation.'), 'error');
        } finally {
            setInvitingId(null);
        }
    };

    const handleCancel = async (invitationId: number) => {
        setCancellingId(invitationId);
        try {
            await cancelTournamentInvitation(tournamentId, invitationId);
            showMessage('Invitation revoked.', 'success');
            void loadInvitations();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to revoke invitation.'), 'error');
        } finally {
            setCancellingId(null);
        }
    };

    const pendingInvites = invitations.filter((i) => i.status === 'PENDING');
    const resolvedInvites = invitations.filter((i) => i.status !== 'PENDING');
    const searchResults = searchTarget === 'clubs' ? clubResults : playerResults;

    const invLabel = (inv: TournamentInvitationDto) => {
        if (inv.clubName) return inv.clubName;
        if (inv.squadName) return inv.squadName;
        return `Invitation #${inv.id}`;
    };

    const btnDefault = 'inline-flex items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-40';
    const btnDestructive = 'inline-flex items-center justify-center rounded-xl border border-[color:var(--color-danger)]/30 bg-[var(--color-surface)] p-1.5 text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger)]/10 disabled:opacity-50';

    return (
        <div>
            {/* Search & Invite */}
            <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-5 py-3">
                <p className="text-sm font-semibold text-[var(--color-text)]">Send Invitations</p>
            </div>

            {/* Search mode toggle */}
            <div className="flex border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
                <button
                    onClick={() => { setSearchTarget('clubs'); setSearchQuery(''); }}
                    className={`flex flex-1 items-center justify-center gap-2 border-r border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-2.5 text-sm font-semibold transition-colors ${
                        searchTarget === 'clubs'
                            ? 'bg-[var(--color-surface)] text-[var(--color-accent)]'
                            : 'text-[var(--color-secondary)] hover:text-[var(--color-text)]'
                    }`}
                >
                    <Building2 className="h-4 w-4" />
                    Clubs / Squads
                </button>
                <button
                    onClick={() => { setSearchTarget('players'); setSearchQuery(''); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                        searchTarget === 'players'
                            ? 'bg-[var(--color-surface)] text-[var(--color-accent)]'
                            : 'text-[var(--color-secondary)] hover:text-[var(--color-text)]'
                    }`}
                >
                    <User className="h-4 w-4" />
                    Players
                </button>
            </div>

            <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-secondary)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchTarget === 'clubs' ? 'Search clubs by name...' : 'Search players by name or username...'}
                        className="w-full rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] py-2 pl-9 pr-4 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-secondary)] focus:border-[var(--color-accent)]"
                    />
                </div>
            </div>

            {/* Search Results */}
            {(searchQuery.trim() || searching) && (
                <div className="max-h-[260px] overflow-y-auto border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
                    {searching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[var(--color-secondary)]">No {searchTarget} found.</div>
                    ) : searchTarget === 'clubs' ? (
                        (searchResults as ClubSearchResult[]).map((club) => {
                            const alreadyInvited = invitations.some((i) => i.clubId === club.id && i.status === 'PENDING');
                            return (
                                <div key={club.id} className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 transition-colors hover:bg-[var(--color-surface)]">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{club.name}</p>
                                        {(club.cityName || club.city) && <p className="text-xs text-[var(--color-secondary)]">{club.cityName || club.city}{club.memberCount != null ? ` · ${club.memberCount} members` : ''}</p>}
                                    </div>
                                    {alreadyInvited ? (
                                        <span className="shrink-0 rounded-xl bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-secondary)]">Invited</span>
                                    ) : (
                                        <button onClick={() => handleInviteClub(club.id)} disabled={invitingId === `club-${club.id}`} className={btnDefault}>
                                            {invitingId === `club-${club.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        (searchResults as UserSearchResult[]).map((user) => {
                            const alreadyInvited = invitations.some((i) => i.status === 'PENDING');
                            return (
                                <div key={user.id} className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 transition-colors hover:bg-[var(--color-surface)]">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{user.fullName ?? user.username}</p>
                                        <p className="text-xs text-[var(--color-secondary)]">{user.position ? `${user.position} · ` : ''}@{user.username}</p>
                                    </div>
                                    {alreadyInvited ? (
                                        <span className="shrink-0 rounded-xl bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-secondary)]">Invited</span>
                                    ) : (
                                        <button onClick={() => handleInvitePlayer(user.id)} disabled={invitingId === `player-${user.id}`} className={btnDefault}>
                                            {invitingId === `player-${user.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Message toast */}
            {message && (
                <div className={`border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                }`}>
                    {message}
                </div>
            )}

            {/* Pending Invitations */}
            <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-5 py-3">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                    Pending
                    {pendingInvites.length > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-xl bg-[color:var(--color-warning)]/20 px-1.5 text-xs font-bold text-[color:var(--color-warning)]">
                            {pendingInvites.length}
                        </span>
                    )}
                </p>
            </div>
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
                </div>
            ) : pendingInvites.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--color-secondary)]">No pending invitations.</div>
            ) : (
                <div className="max-h-[200px] overflow-y-auto border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
                    {pendingInvites.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 transition-colors hover:bg-[var(--color-surface)]">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{invLabel(inv)}</p>
                                {inv.squadName && inv.clubName && <p className="text-xs text-[var(--color-secondary)]">{inv.clubName}</p>}
                            </div>
                            <span className="shrink-0 rounded-xl border px-2.5 py-0.5 text-xs font-semibold bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30">PENDING</span>
                            <button onClick={() => handleCancel(inv.id)} disabled={cancellingId === inv.id} className={btnDestructive} title="Revoke invitation">
                                {cancellingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Resolved Invitations */}
            {resolvedInvites.length > 0 && (
                <>
                    <div className="border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-5 py-3">
                        <p className="text-sm font-semibold text-[var(--color-text)]">History</p>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto">
                        {resolvedInvites.map((inv) => {
                            const tone = statusToneBorder[inv.status] ?? statusToneBorder.CANCELLED;
                            return (
                                <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{invLabel(inv)}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-xl border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{inv.status}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
