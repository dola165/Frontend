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
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    ACCEPTED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    DECLINED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    CANCELLED: 'bg-[#16181d] text-[#a1a1aa] border-[#ffffff0d]',
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

    const btnDefault = 'inline-flex items-center gap-1.5 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] disabled:opacity-40';
    const btnDestructive = 'inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-[#16181d] p-1.5 text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50';

    return (
        <div>
            {/* Search & Invite */}
            <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                <p className="text-sm font-semibold text-[#f4f4f5]">Send Invitations</p>
            </div>

            {/* Search mode toggle */}
            <div className="flex border-b border-[#ffffff0d]">
                <button
                    onClick={() => { setSearchTarget('clubs'); setSearchQuery(''); }}
                    className={`flex flex-1 items-center justify-center gap-2 border-r border-[#ffffff0d] px-4 py-2.5 text-sm font-semibold transition-colors ${
                        searchTarget === 'clubs'
                            ? 'bg-[#16181d] text-[#16a34a]'
                            : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                >
                    <Building2 className="h-4 w-4" />
                    Clubs / Squads
                </button>
                <button
                    onClick={() => { setSearchTarget('players'); setSearchQuery(''); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                        searchTarget === 'players'
                            ? 'bg-[#16181d] text-[#16a34a]'
                            : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                >
                    <User className="h-4 w-4" />
                    Players
                </button>
            </div>

            <div className="border-b border-[#ffffff0d] px-4 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1aa]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchTarget === 'clubs' ? 'Search clubs by name...' : 'Search players by name or username...'}
                        className="w-full rounded-xl border border-[#ffffff0d] bg-[#16181d] py-2 pl-9 pr-4 text-sm text-[#f4f4f5] outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a]"
                    />
                </div>
            </div>

            {/* Search Results */}
            {(searchQuery.trim() || searching) && (
                <div className="max-h-[260px] overflow-y-auto border-b border-[#ffffff0d]">
                    {searching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-[#16a34a]" />
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[#a1a1aa]">No {searchTarget} found.</div>
                    ) : searchTarget === 'clubs' ? (
                        (searchResults as ClubSearchResult[]).map((club) => {
                            const alreadyInvited = invitations.some((i) => i.clubId === club.id && i.status === 'PENDING');
                            return (
                                <div key={club.id} className="flex items-center justify-between gap-2 border-b border-[#ffffff0d] px-4 py-3 transition-colors hover:bg-[#1a1c22]">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[#f4f4f5]">{club.name}</p>
                                        {(club.cityName || club.city) && <p className="text-xs text-[#a1a1aa]">{club.cityName || club.city}{club.memberCount != null ? ` · ${club.memberCount} members` : ''}</p>}
                                    </div>
                                    {alreadyInvited ? (
                                        <span className="shrink-0 rounded-xl bg-[#1a1c22] px-3 py-1 text-xs font-medium text-[#a1a1aa]">Invited</span>
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
                                <div key={user.id} className="flex items-center justify-between gap-2 border-b border-[#ffffff0d] px-4 py-3 transition-colors hover:bg-[#1a1c22]">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[#f4f4f5]">{user.fullName ?? user.username}</p>
                                        <p className="text-xs text-[#a1a1aa]">{user.position ? `${user.position} · ` : ''}@{user.username}</p>
                                    </div>
                                    {alreadyInvited ? (
                                        <span className="shrink-0 rounded-xl bg-[#1a1c22] px-3 py-1 text-xs font-medium text-[#a1a1aa]">Invited</span>
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
                <div className={`border-b border-[#ffffff0d] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[#16a34a]/10 text-[#16a34a]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}>
                    {message}
                </div>
            )}

            {/* Pending Invitations */}
            <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                <p className="text-sm font-semibold text-[#f4f4f5]">
                    Pending
                    {pendingInvites.length > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-xl bg-amber-500/20 px-1.5 text-xs font-bold text-amber-400">
                            {pendingInvites.length}
                        </span>
                    )}
                </p>
            </div>
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-[#16a34a]" />
                </div>
            ) : pendingInvites.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[#a1a1aa]">No pending invitations.</div>
            ) : (
                <div className="max-h-[200px] overflow-y-auto border-b border-[#ffffff0d]">
                    {pendingInvites.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-[#ffffff0d] px-4 py-3 transition-colors hover:bg-[#1a1c22]">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[#f4f4f5]">{invLabel(inv)}</p>
                                {inv.squadName && inv.clubName && <p className="text-xs text-[#a1a1aa]">{inv.clubName}</p>}
                            </div>
                            <span className="shrink-0 rounded-xl border px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border-amber-500/30">PENDING</span>
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
                    <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                        <p className="text-sm font-semibold text-[#f4f4f5]">History</p>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto">
                        {resolvedInvites.map((inv) => {
                            const tone = statusToneBorder[inv.status] ?? statusToneBorder.CANCELLED;
                            return (
                                <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-[#ffffff0d] px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[#f4f4f5]">{invLabel(inv)}</p>
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
