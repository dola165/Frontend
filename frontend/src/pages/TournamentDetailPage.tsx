import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, Loader2, Shield, Trophy, UserPlus, Users } from 'lucide-react';
import { fetchTournament, registerPlayer } from '../features/tournaments/api';
import type { TournamentDetail } from '../features/tournaments/domain';
import { tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';

const statusTone: Record<string, string> = {
    PLANNING: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    COMPLETED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
};

export const TournamentDetailPage = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const id = Number(tournamentId);
    const isStaff = tournament?.staffAssignments?.some((s) => s.userId === user?.id && s.status === 'ACTIVE');
    const userEntry = tournament?.entries?.find((e) => e.userId === user?.id);
    const isRegistered = userEntry != null;
    const canRegister = tournament?.participantScope === 'PLAYER' && tournament?.status === 'PLANNING' && isAuthenticated && !isRegistered;
    const entryCount = tournament?.entries?.length ?? 0;
    const fixtureCount = tournament?.fixtures?.length ?? 0;

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

    if (loading) {
        return (
            <div className="flex min-h-full items-center justify-center bg-base">
                <Loader2 className="h-8 w-8 animate-spin accent-primary" />
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-base px-6 text-center">
                <Trophy className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                <h1 className="text-xl font-black uppercase tracking-tight text-primary">Event Not Found</h1>
                <p className="text-sm text-secondary">{error ?? 'This event does not exist or has been removed.'}</p>
                <Link to="/tournaments" className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-primary-hover">
                    Back to Events
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-base">
            <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8 sm:px-6">
                {message && (
                    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        message.type === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <Link to="/tournaments" className="text-xs font-semibold text-secondary hover:text-primary">
                            &larr; Back to Events
                        </Link>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary sm:text-4xl">{tournament.name}</h1>
                        {tournament.description && (
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">{tournament.description}</p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone[tournament.status] ?? statusTone.COMPLETED}`}>
                            {tournament.status}
                        </span>
                        {canRegister && (
                            <button
                                type="button"
                                onClick={handleRegister}
                                disabled={registering}
                                className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
                            >
                                {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                Register
                            </button>
                        )}
                        {isRegistered && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <Shield className="h-4 w-4" />
                                Registered
                            </span>
                        )}
                        {isStaff && (
                            <Link
                                to={`/tournaments/${tournament.id}/workspace`}
                                className="inline-flex items-center gap-2 rounded-full border border-subtle bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-accent-primary"
                            >
                                <Shield className="h-4 w-4" />
                                Workspace
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-subtle bg-surface px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Scope</p>
                        <div className="mt-2 flex items-center gap-2">
                            {tournament.participantScope === 'PLAYER' ? <UserPlus className="h-4 w-4 accent-primary" /> : <Users className="h-4 w-4 accent-primary" />}
                            <span className="text-sm font-semibold text-primary">{tournamentScopeLabel(tournament.participantScope)}</span>
                        </div>
                    </div>
                    <div className="rounded-xl border border-subtle bg-surface px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Visibility</p>
                        <p className="mt-2 text-sm font-semibold text-primary">{tournamentVisibilityLabel(tournament.visibility)}</p>
                    </div>
                    <div className="rounded-xl border border-subtle bg-surface px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Participants</p>
                        <p className="mt-2 text-sm font-semibold text-primary">{entryCount} entr{entryCount === 1 ? 'y' : 'ies'} &middot; {fixtureCount} fixture{fixtureCount === 1 ? '' : 's'}</p>
                    </div>
                </div>

                {tournament.startDate && (
                    <div className="flex flex-wrap gap-4 text-sm text-secondary">
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

                {tournament.rules && (
                    <div className="rounded-xl border border-subtle bg-surface px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Rules</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{tournament.rules}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
