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
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    DECLINED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
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

    const btnDefault = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';
    const btnDestructive = 'inline-flex items-center justify-center rounded-full border border-rose-200 bg-white p-1.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10';

    return (
        <div>
            {/* Search & Invite */}
            <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Send Invitations</p>
            </div>

            {/* Search mode toggle */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => { setSearchTarget('clubs'); setSearchQuery(''); }}
                    className={`flex flex-1 items-center justify-center gap-2 border-r border-slate-200 px-4 py-2.5 text-sm font-semibold transition-colors dark:border-slate-800 ${
                        searchTarget === 'clubs'
                            ? 'bg-white text-[#1f6feb] dark:bg-slate-900 dark:text-[#4c8dff]'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                >
                    <Building2 className="h-4 w-4" />
                    Clubs / Squads
                </button>
                <button
                    onClick={() => { setSearchTarget('players'); setSearchQuery(''); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                        searchTarget === 'players'
                            ? 'bg-white text-[#1f6feb] dark:bg-slate-900 dark:text-[#4c8dff]'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                >
                    <User className="h-4 w-4" />
                    Players
                </button>
            </div>

            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchTarget === 'clubs' ? 'Search clubs by name...' : 'Search players by name or username...'}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1f6feb] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#4c8dff]"
                    />
                </div>
            </div>

            {/* Search Results */}
            {(searchQuery.trim() || searching) && (
                <div className="max-h-[260px] overflow-y-auto border-b border-slate-200 dark:border-slate-800">
                    {searching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-[#1f6feb]" />
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No {searchTarget} found.</div>
                    ) : searchTarget === 'clubs' ? (
                        (searchResults as ClubSearchResult[]).map((club) => {
                            const alreadyInvited = invitations.some((i) => i.clubId === club.id && i.status === 'PENDING');
                            return (
                                <div key={club.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{club.name}</p>
                                        {(club.cityName || club.city) && <p className="text-xs text-slate-500 dark:text-slate-400">{club.cityName || club.city}{club.memberCount != null ? ` · ${club.memberCount} members` : ''}</p>}
                                    </div>
                                    {alreadyInvited ? (
                                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">Invited</span>
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
                                <div key={user.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{user.fullName ?? user.username}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.position ? `${user.position} · ` : ''}@{user.username}</p>
                                    </div>
                                    {alreadyInvited ? (
                                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">Invited</span>
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
                <div className={`border-b px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                }`}>
                    {message}
                </div>
            )}

            {/* Pending Invitations */}
            <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Pending
                    {pendingInvites.length > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                            {pendingInvites.length}
                        </span>
                    )}
                </p>
            </div>
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-[#1f6feb]" />
                </div>
            ) : pendingInvites.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No pending invitations.</div>
            ) : (
                <div className="max-h-[200px] overflow-y-auto border-b border-slate-200 dark:border-slate-800">
                    {pendingInvites.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{invLabel(inv)}</p>
                                {inv.squadName && inv.clubName && <p className="text-xs text-slate-500 dark:text-slate-400">{inv.clubName}</p>}
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder.PENDING}`}>PENDING</span>
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
                    <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">History</p>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto">
                        {resolvedInvites.map((inv) => {
                            const tone = statusToneBorder[inv.status] ?? statusToneBorder.CANCELLED;
                            return (
                                <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{invLabel(inv)}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{inv.status}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
