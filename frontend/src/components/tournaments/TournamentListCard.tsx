import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, Calendar, Check, Loader2, Trophy, UserPlus, Users } from 'lucide-react';
import type { TournamentSummary } from '../../features/tournaments/domain';
import { tournamentScopeLabel, tournamentVisibilityLabel } from '../../features/tournaments/domain';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const statusTone: Record<string, string> = {
    PLANNING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

interface TournamentListCardProps {
    tournament: TournamentSummary;
    isRegistered: boolean;
    isRegistering: boolean;
    onRegister: (tournamentId: number) => void;
}

export const TournamentListCard = ({
    tournament: t,
    isRegistered,
    isRegistering,
    onRegister,
}: TournamentListCardProps) => {
    const [imgFailed, setImgFailed] = useState(false);
    const bannerUrl = resolveMediaUrl(t.bannerImageUrl);

    return (
    <Link
        to={`/tournaments/${t.id}`}
        className="group flex flex-col rounded-xl border border-[#ffffff0d] bg-[#16181d] transition-all hover:border-[#16a34a] overflow-hidden md:flex-row md:h-[120px]"
    >
        {/* Left: Banner / Thumbnail */}
        <div className="flex h-32 w-full shrink-0 items-center justify-center bg-[#1a1c22] md:h-full md:w-[240px] relative">
            {imgFailed || !bannerUrl ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#ffffff0d] bg-[#16181d] text-[#16a34a]">
                    <Trophy className="h-7 w-7" />
                </div>
            ) : (
                <img
                    src={bannerUrl}
                    alt={t.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={() => setImgFailed(true)}
                />
            )}
        </div>

        {/* Center: Primary Details */}
        <div className="flex flex-1 flex-col justify-center px-5 py-3 min-w-0">
            <h3 className="text-base font-semibold text-[#f4f4f5] group-hover:text-[#16a34a] transition-colors truncate">
                {t.name}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#a1a1aa]">
                {t.hostClubName && (
                    <span>Hosted by {t.hostClubName}</span>
                )}
                {t.startDate && (
                    <>
                        {t.hostClubName && <span className="text-[#ffffff0d]">•</span>}
                        <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(t.startDate)}
                            {t.endDate && <span> — {formatDate(t.endDate)}</span>}
                        </span>
                    </>
                )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#a1a1aa]">
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
        </div>

        {/* Center-Right: Incentives snippet */}
        {t.incentives && (
            <div className="hidden items-center border-l border-[#ffffff0d] px-4 lg:flex lg:w-[220px] shrink-0">
                <div className="flex items-start gap-1.5 text-xs text-emerald-400/80">
                    <Award className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{t.incentives.split('|')[0]}</span>
                </div>
            </div>
        )}

        {/* Far Right: Status + Actions */}
        <div className="flex flex-row items-center justify-between gap-3 border-t border-[#ffffff0d] px-4 py-3 md:flex-col md:items-end md:justify-center md:border-l md:border-t-0 md:w-[160px] shrink-0">
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[t.status] ?? statusTone.COMPLETED}`}>
                {t.status}
            </span>

            <div className="flex items-center gap-3">
                {t.participantScope === 'PLAYER' && t.status === 'PLANNING' && (
                    isRegistered ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                            <Check className="h-3 w-3" />
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
                            className="inline-flex items-center gap-1 rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                            {isRegistering ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <UserPlus className="h-3 w-3" />
                            )}
                            Register
                        </button>
                    )
                )}
                <span className="text-sm font-medium text-[#16a34a] group-hover:underline whitespace-nowrap">
                    View <ArrowRight className="ml-1 inline-block h-4 w-4" />
                </span>
            </div>
        </div>
    </Link>
    );
};
