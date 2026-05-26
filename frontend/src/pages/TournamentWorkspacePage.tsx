import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Trophy } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournament } from '../features/tournaments/api';
import { BracketEditor } from '../features/tournaments/components/BracketEditor';
import { QueueAndDraftBuilder } from '../features/tournaments/components/QueueAndDraftBuilder';
import type { TournamentDetail } from '../features/tournaments/domain';
import { tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';

const labelClass = 'text-[10px] font-black uppercase tracking-[0.16em] text-muted';

export const TournamentWorkspacePage = () => {
    const { tournamentId: tournamentIdParam } = useParams<{ tournamentId: string }>();
    const tournamentId = tournamentIdParam ? Number(tournamentIdParam) : null;

    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTournament = useCallback(async () => {
        if (tournamentId == null || Number.isNaN(tournamentId)) {
            setError('Invalid tournament ID.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setTournament(await fetchTournament(tournamentId));
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Failed to load tournament.'));
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        void loadTournament();
    }, [loadTournament]);

    if (loading) {
        return (
            <div className="bg-base flex min-h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-muted" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">Loading Tournament</p>
                </div>
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="bg-base flex min-h-full items-center justify-center">
                <div className="max-w-md text-center">
                    <Trophy className="mx-auto mb-4 h-12 w-12 text-muted" />
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Tournament Not Found</p>
                    <p className="mt-2 text-sm text-secondary">{error ?? 'The tournament could not be loaded.'}</p>
                    <Link to="/tournaments/setup" className="mt-6 inline-flex items-center gap-2 border border-subtle bg-surface px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-elevated">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Setup
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="tournament-workspace-shell bg-base min-h-full">
            {/* Header */}
            <div className="border-b-2 border-strong bg-surface px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link to="/tournaments/setup" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted transition-colors hover:text-primary">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Setup
                        </Link>
                        <h1 className="mt-1 text-xl font-black uppercase tracking-tight text-primary">
                            {tournament.name}
                        </h1>
                        <p className="mt-1 text-xs text-muted">
                            Tournament #{tournament.id} &middot; {tournament.status}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                        <span className="border border-subtle bg-base px-2.5 py-1 text-primary">
                            {tournamentScopeLabel(tournament.participantScope)}
                        </span>
                        <span className="border border-subtle bg-base px-2.5 py-1 text-primary">
                            {tournamentVisibilityLabel(tournament.visibility)}
                        </span>
                        <span className={`border px-2.5 py-1 ${
                            tournament.status === 'ACTIVE' ? 'border-emerald-600 text-emerald-600' :
                            tournament.status === 'COMPLETED' ? 'border-zinc-500 text-zinc-500' :
                            tournament.status === 'CANCELLED' ? 'border-rose-600 text-rose-600' :
                            'border-sky-600 text-sky-600'
                        }`}>
                            {tournament.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Three-column workspace */}
            <div className="mx-auto grid max-w-[1880px] grid-cols-1 gap-0 px-4 pb-10 pt-4 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:gap-4 xl:px-6">
                {/* Left Rail — Queue & Draft Builder */}
                <aside className="flex flex-col gap-3">
                    <div className="border border-subtle bg-surface">
                        <QueueAndDraftBuilder
                            tournamentId={tournament.id}
                            tournament={tournament}
                            onRefresh={loadTournament}
                        />
                    </div>
                </aside>

                {/* Center — Bracket Editor */}
                <section className="min-w-0">
                    <div className="border border-subtle bg-surface">
                        <BracketEditor
                            tournamentId={tournament.id}
                            tournament={tournament}
                            onRefresh={loadTournament}
                        />
                    </div>
                </section>

                {/* Right Rail — Info Panel */}
                <aside className="flex flex-col gap-3">
                    <div className="border border-subtle bg-surface">
                        <div className="tw-section-header">Tournament Info</div>
                        <div className="divide-y divide-[color:var(--border-subtle)]">
                            <div className="flex justify-between gap-3 px-3 py-2.5 text-xs">
                                <span className={labelClass}>Host Club</span>
                                <span className="text-right font-bold text-primary">
                                    {tournament.hostClubId ?? 'None'}
                                </span>
                            </div>
                            <div className="flex justify-between gap-3 px-3 py-2.5 text-xs">
                                <span className={labelClass}>Organizer</span>
                                <span className="text-right font-bold text-primary">
                                    #{tournament.organizerOrganizationId}
                                </span>
                            </div>
                            {tournament.startDate && (
                                <div className="flex justify-between gap-3 px-3 py-2.5 text-xs">
                                    <span className={labelClass}>Starts</span>
                                    <span className="text-right font-bold text-primary">
                                        {new Date(tournament.startDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {tournament.endDate && (
                                <div className="flex justify-between gap-3 px-3 py-2.5 text-xs">
                                    <span className={labelClass}>Ends</span>
                                    <span className="text-right font-bold text-primary">
                                        {new Date(tournament.endDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {tournament.registrationOpensAt && (
                                <div className="flex justify-between gap-3 px-3 py-2.5 text-xs">
                                    <span className={labelClass}>Reg Opens</span>
                                    <span className="text-right font-bold text-primary">
                                        {new Date(tournament.registrationOpensAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {tournament.registrationClosesAt && (
                                <div className="flex justify-between gap-3 px-3 py-2.5 text-xs">
                                    <span className={labelClass}>Reg Closes</span>
                                    <span className="text-right font-bold text-primary">
                                        {new Date(tournament.registrationClosesAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {tournament.description && (
                        <div className="border border-subtle bg-surface">
                            <div className="tw-section-header">Description</div>
                            <p className="px-3 py-2.5 text-xs leading-5 text-secondary">{tournament.description}</p>
                        </div>
                    )}

                    {tournament.rules && (
                        <div className="border border-subtle bg-surface">
                            <div className="tw-section-header">Rules</div>
                            <p className="whitespace-pre-wrap px-3 py-2.5 text-xs leading-5 text-secondary">{tournament.rules}</p>
                        </div>
                    )}

                    {/* Staff */}
                    {(tournament.staffAssignments?.length ?? 0) > 0 && (
                        <div className="border border-subtle bg-surface">
                            <div className="tw-section-header">Staff ({tournament.staffAssignments.length})</div>
                            <div className="max-h-[200px] overflow-y-auto">
                                {tournament.staffAssignments.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between gap-2 border-b border-subtle px-3 py-2 text-xs">
                                        <span className="truncate font-bold text-primary">{s.fullName}</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">{s.role}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};
