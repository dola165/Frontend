import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, Clock, Loader2, Shield, Trophy, UserPlus, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchTournament, registerPlayer, requestEntry } from '../features/tournaments/api';
import type { TournamentDetail } from '../features/tournaments/domain';
import { tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { apiClient } from '../api/axiosConfig';

const statusTone: Record<string, string> = {
    PLANNING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export const TournamentDetailPage = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const { t } = useTranslation();
    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const id = Number(tournamentId);
    const isStaff = tournament?.staffAssignments?.some((s) => s.userId === user?.id && s.status === 'ACTIVE');
    const userEntry = tournament?.entries?.find((e) => e.userId === user?.id);
    const isRegistered = userEntry != null;
    const entryCount = tournament?.entries?.length ?? 0;
    const fixtureCount = tournament?.fixtures?.length ?? 0;
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubName, setMyClubName] = useState<string | null>(null);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [mySquads, setMySquads] = useState<{ id: number; name: string }[]>([]);
    const [selectedSquadId, setSelectedSquadId] = useState('');
    const [entrySubmitting, setEntrySubmitting] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const scope = tournament?.participantScope;
    const policy = tournament?.registrationPolicy;
    const userClubHasEntry = myClubId != null && tournament?.entries?.some(e => e.clubId === myClubId);
    const canRegisterPlayer = scope === 'PLAYER' && tournament?.status === 'PLANNING' && isAuthenticated && !isRegistered;
    const canRequestClubEntry = (scope === 'CLUB' || scope === 'SQUAD') && tournament?.status === 'PLANNING' && isAuthenticated && myClubId != null && policy !== 'INVITE_ONLY' && !userClubHasEntry;
    const isInviteOnly = policy === 'INVITE_ONLY' && tournament?.status === 'PLANNING';
    const canWithdraw = isRegistered && tournament?.status === 'PLANNING';

    useEffect(() => {
        if (!id) return;
        let active = true;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchTournament(id);
                if (active) setTournament(data);
            } catch (err) {
                if (active) setError(extractApiErrorMessage(err, 'Failed to load tournament details.'));
            } finally {
                if (active) setLoading(false);
            }
        };

        void load();
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        if (!isAuthenticated) return;
        apiClient.get('/clubs/my-club')
            .then(res => {
                if (res.data?.clubId) {
                    setMyClubId(res.data.clubId);
                    setMyClubName(res.data.clubName ?? null);
                }
            })
            .catch(() => { /* user has no club */ });
    }, [isAuthenticated]);

    const handleRegister = async () => {
        if (!isAuthenticated) {
            navigate(buildLoginRedirectPath(window.location.pathname));
            return;
        }
        setRegistering(true);
        try {
            await registerPlayer(id);
            setMessage({ text: 'Successfully registered for the event.', type: 'success' });
            const data = await fetchTournament(id);
            setTournament(data);
        } catch (err) {
            setMessage({ text: extractApiErrorMessage(err, 'Failed to register.'), type: 'error' });
        } finally {
            setRegistering(false);
        }
    };

    const openEntryModal = async () => {
        setSelectedSquadId('');
        setMySquads([]);
        setShowEntryModal(true);
        if (!myClubId) return;
        try {
            const res = await apiClient.get<Array<{ id?: number; name?: string }>>(`/clubs/${myClubId}/squads`);
            setMySquads(
                (res.data ?? [])
                    .map((s) => ({ id: s.id ?? 0, name: s.name ?? '—' }))
                    .filter((s) => s.id > 0),
            );
        } catch {
            setMySquads([]);
        }
    };

    const handleConfirmEntry = async () => {
        if (!myClubId) return;
        setEntrySubmitting(true);
        try {
            await requestEntry(id, {
                clubId: myClubId,
                squadId: selectedSquadId ? Number(selectedSquadId) : null,
            });
            setMessage({ text: 'Entry request submitted successfully.', type: 'success' });
            setShowEntryModal(false);
            const data = await fetchTournament(id);
            setTournament(data);
        } catch (err) {
            setMessage({ text: extractApiErrorMessage(err, 'Failed to request entry.'), type: 'error' });
        } finally {
            setEntrySubmitting(false);
        }
    };

    const handleWithdraw = async () => {
        if (!userEntry) return;
        if (!window.confirm('Are you sure you want to withdraw your entry from this tournament?')) return;
        setWithdrawing(true);
        try {
            await apiClient.post(`/tournaments/${id}/entries/${userEntry.id}/withdraw`);
            setMessage({ text: 'Successfully withdrawn from the tournament.', type: 'success' });
            const data = await fetchTournament(id);
            setTournament(data);
        } catch (err) {
            setMessage({ text: extractApiErrorMessage(err, 'Failed to withdraw.'), type: 'error' });
        } finally {
            setWithdrawing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#0f1117]">
                <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#0f1117] px-6 text-center">
                <Trophy className="h-12 w-12 text-[#a1a1aa]" />
                <h1 className="text-xl font-semibold text-[#f4f4f5]">Tournament Not Found</h1>
                <p className="text-sm text-[#a1a1aa]">{error ?? 'This tournament does not exist or has been removed.'}</p>
                <Link to="/tournaments" className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    Back to Tournaments
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#0f1117]">
            <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8 sm:px-6">
                {message && (
                    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        message.type === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-red-500/20 bg-red-500/10 text-red-400'
                    }`}>
                        {message.text}
                    </div>
                )}

                {resolveMediaUrl(tournament.bannerImageUrl) && (
                    <div className="overflow-hidden rounded-xl border border-[#ffffff0d] bg-[#16181d]">
                        <img
                            src={resolveMediaUrl(tournament.bannerImageUrl)}
                            alt=""
                            className="h-44 w-full object-cover sm:h-56"
                        />
                    </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <Link to="/tournaments" className="text-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
                            ← Back to Tournaments
                        </Link>
                        <h1 className="mt-2 text-2xl font-semibold text-[#f4f4f5]">{tournament.name}</h1>
                        {tournament.description && (
                            <p className="mt-3 max-w-2xl text-sm text-[#a1a1aa]">{tournament.description}</p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone[tournament.status] ?? statusTone.COMPLETED}`}>
                            {tournament.status}
                        </span>
                        {isInviteOnly && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
                                <Shield className="h-3.5 w-3.5" />
                                Invite Only
                            </span>
                        )}
                        {canRegisterPlayer && (
                            <button
                                type="button"
                                onClick={handleRegister}
                                disabled={registering}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                                {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                Register
                            </button>
                        )}
                        {canRequestClubEntry && (
                            <button
                                type="button"
                                onClick={openEntryModal}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                            >
                                <Building2 className="h-4 w-4" />
                                Request Entry
                            </button>
                        )}
                        {canWithdraw && (
                            <button
                                type="button"
                                onClick={handleWithdraw}
                                disabled={withdrawing}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                            >
                                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                Withdraw
                            </button>
                        )}
                        {isRegistered && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
                                <Shield className="h-4 w-4" />
                                Registered
                            </span>
                        )}
                        {isStaff && (
                            <Link
                                to={`/tournaments/${tournament.id}/workspace`}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff0d] px-5 py-2.5 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[var(--fc-surface-hover)]"
                            >
                                <Shield className="h-4 w-4" />
                                Workspace
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-5 py-4">
                        <p className="text-xs font-medium text-[#a1a1aa]">Scope</p>
                        <div className="mt-2 flex items-center gap-2">
                            {tournament.participantScope === 'PLAYER' ? <UserPlus className="h-4 w-4 text-[#16a34a]" /> : <Users className="h-4 w-4 text-[#16a34a]" />}
                            <span className="text-sm font-semibold text-[#f4f4f5]">{tournamentScopeLabel(tournament.participantScope)}</span>
                        </div>
                    </div>
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-5 py-4">
                        <p className="text-xs font-medium text-[#a1a1aa]">Visibility</p>
                        <p className="mt-2 text-sm font-semibold text-[#f4f4f5]">{tournamentVisibilityLabel(tournament.visibility)}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-5 py-4">
                        <p className="text-xs font-medium text-[#a1a1aa]">Participants</p>
                        <p className="mt-2 text-sm font-semibold text-[#f4f4f5]">{entryCount} entr{entryCount === 1 ? 'y' : 'ies'} &middot; {fixtureCount} fixture{fixtureCount === 1 ? '' : 's'}</p>
                    </div>
                </div>

                {tournament.startDate && (
                    <div className="flex flex-wrap gap-4 text-sm text-[#a1a1aa]">
                        <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {new Date(tournament.startDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            {tournament.endDate && <> &mdash; {new Date(tournament.endDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</>}
                        </span>
                        {tournament.registrationOpensAt && (
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                Registration: {new Date(tournament.registrationOpensAt).toLocaleDateString()}
                                {tournament.registrationClosesAt && <> &mdash; {new Date(tournament.registrationClosesAt).toLocaleDateString()}</>}
                            </span>
                        )}
                    </div>
                )}

                {tournament.incentives && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                        <p className="text-xs font-medium text-emerald-400">Incentives &amp; Prizes</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-400/80">{tournament.incentives}</p>
                    </div>
                )}

                {tournament.rules && (
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-5 py-4">
                        <p className="text-xs font-medium text-[#a1a1aa]">Rules</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[#a1a1aa]">{tournament.rules}</p>
                    </div>
                )}
            </div>

            {/* Entry Request Modal */}
            {showEntryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowEntryModal(false)}>
                    <div className="bg-[#16181d] border border-[#ffffff0d] rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-[#f4f4f5]">Request Tournament Entry</h3>
                            <button onClick={() => setShowEntryModal(false)} className="text-[#71717a] hover:text-[#a1a1aa]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-[#a1a1aa] mb-4">
                            Submit an entry request for <span className="text-[#f4f4f5] font-medium">{tournament.name}</span>.
                            {scope === 'CLUB' && ' This is a club-level tournament.'}
                            {scope === 'SQUAD' && ' This is a squad-level tournament.'}
                        </p>
                        <div className="rounded-xl border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4 text-[#16a34a]" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[#f4f4f5]">{myClubName || 'Your Club'}</p>
                                    <p className="text-xs text-[#71717a]">{scope === 'SQUAD' ? 'Entering with a squad' : 'Club entry'}</p>
                                </div>
                            </div>
                        </div>
                        {scope === 'SQUAD' && mySquads.length === 0 && (
                            <p className="mb-4 text-xs font-semibold text-amber-400">{t('tournaments.diagram.noSquadsAvailable')}</p>
                        )}
                        {mySquads.length > 0 && (
                            <label className="mb-4 block">
                                <span className="mb-1.5 block text-xs font-semibold text-[#a1a1aa]">
                                    {scope === 'SQUAD' ? t('tournaments.entry.squadRequired') : t('tournaments.entry.selectSquad')}
                                </span>
                                <select
                                    value={selectedSquadId}
                                    onChange={(e) => setSelectedSquadId(e.target.value)}
                                    className="w-full rounded-xl border border-[#ffffff0d] bg-[#0f1117] px-3 py-2.5 text-sm font-semibold text-[#f4f4f5] outline-none focus:border-[#16a34a]"
                                >
                                    {scope === 'CLUB' && <option value="">{t('tournaments.entry.playAsClub')}</option>}
                                    {mySquads.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowEntryModal(false)}
                                className="px-4 py-2 text-xs font-medium text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmEntry}
                                disabled={entrySubmitting || (scope === 'SQUAD' && !selectedSquadId)}
                                className="px-4 py-2 text-xs font-semibold bg-[#16a34a] text-white rounded-xl hover:bg-[#22c55e] disabled:opacity-50 transition-colors"
                            >
                                {entrySubmitting ? 'Submitting...' : 'Submit Entry Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
