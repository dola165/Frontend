import { Link } from 'react-router-dom';
import { ArrowRight, Award, Calendar, Check, Loader2, Trophy, UserPlus, Users } from 'lucide-react';
import type { TournamentSummary } from '../../features/tournaments/domain';
import { tournamentScopeLabel, tournamentVisibilityLabel } from '../../features/tournaments/domain';

const statusTone: Record<string, string> = {
    PLANNING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface TournamentCardProps {
    tournament: TournamentSummary;
    isRegistered: boolean;
    isRegistering: boolean;
    onRegister: (tournamentId: number) => void;
}

export const TournamentCard = ({
    tournament: t,
    isRegistered,
    isRegistering,
    onRegister,
}: TournamentCardProps) => (
    <Link
        to={`/tournaments/${t.id}`}
        className="group flex flex-col rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5 transition-all hover:border-[#16a34a]"
    >
        <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ffffff0d] bg-[#1a1c22] text-[#16a34a]">
                <Trophy className="h-5 w-5" />
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[t.status] ?? statusTone.COMPLETED}`}>
                {t.status}
            </span>
        </div>

        <h3 className="mt-4 text-base font-semibold text-[#f4f4f5] group-hover:text-[#16a34a] transition-colors">
            {t.name}
        </h3>

        {t.description && (
            <p className="mt-2 line-clamp-2 text-sm text-[#a1a1aa]">
                {t.description}
            </p>
        )}

        {t.incentives && (
            <div className="mt-3 flex items-start gap-1.5 text-xs text-emerald-400/80">
                <Award className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1">{t.incentives.split('|')[0]}</span>
            </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#a1a1aa]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1a1c22] px-2.5 py-1">
                {t.participantScope === 'PLAYER' ? <UserPlus className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                {tournamentScopeLabel(t.participantScope)}
            </span>
            <span className="rounded-full bg-[#1a1c22] px-2.5 py-1">
                {tournamentVisibilityLabel(t.visibility)}
            </span>
            {t.entryCount > 0 && (
                <span className="rounded-full bg-[#1a1c22] px-2.5 py-1">
                    {t.entryCount} entries
                </span>
            )}
        </div>

        {t.hostClubName && (
            <p className="mt-3 text-xs text-[#a1a1aa]">
                Hosted by {t.hostClubName}
            </p>
        )}

        {t.startDate && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(t.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {t.endDate && (
                    <span>— {new Date(t.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
            </div>
        )}

        <div className="mt-5 flex items-center gap-2 pt-3">
            <span className="flex-1 text-sm font-medium text-[#16a34a] group-hover:underline">
                View Event
                <ArrowRight className="ml-1.5 inline-block h-4 w-4" />
            </span>
            {t.participantScope === 'PLAYER' && t.status === 'PLANNING' && (
                isRegistered ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        Registered
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRegister(t.id);
                        }}
                        disabled={isRegistering}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                        {isRegistering ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Register
                    </button>
                )
            )}
        </div>
    </Link>
);
