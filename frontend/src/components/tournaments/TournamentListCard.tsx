import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, Loader2, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TournamentSummary } from '../../features/tournaments/domain';
import {
    TournamentScopeBadge,
    TournamentStatusBadge,
    TournamentVisual,
} from './TournamentPresentation';
import { formatTournamentDate, formatTournamentDateRange, tournamentVisibilityText } from './tournamentFormatters';

interface TournamentListCardProps {
    tournament: TournamentSummary;
    isRegistered: boolean;
    isRegistering: boolean;
    onRegister: (tournamentId: number) => void;
}

export const TournamentListCard = ({
    tournament,
    isRegistered,
    isRegistering,
    onRegister,
}: TournamentListCardProps) => {
    const { t, i18n } = useTranslation();
    const dateRange = formatTournamentDateRange(tournament.startDate, tournament.endDate, i18n.language);
    const registrationClose = formatTournamentDate(tournament.registrationClosesAt, i18n.language);
    const hostName = tournament.hostClubName ?? tournament.organizerName;
    const canRegister = tournament.participantScope === 'PLAYER' && tournament.status === 'PLANNING';

    return (
        <article className="group grid overflow-hidden rounded-2xl border border-white/[0.07] bg-[#15181c] shadow-[0_16px_44px_rgba(0,0,0,0.1)] transition duration-200 hover:border-emerald-400/30 hover:shadow-[0_20px_52px_rgba(0,0,0,0.2)] focus-within:border-emerald-400/40 md:grid-cols-[220px_minmax(0,1fr)_190px] xl:grid-cols-[260px_minmax(0,1fr)_220px]">
            <TournamentVisual name={tournament.name} imageUrl={tournament.bannerImageUrl} className="h-44 md:h-full md:min-h-44">
                <div className="flex h-full items-start justify-between gap-2 p-4 md:hidden">
                    <TournamentStatusBadge status={tournament.status} />
                    <TournamentScopeBadge scope={tournament.participantScope} />
                </div>
            </TournamentVisual>

            <div className="flex min-w-0 flex-col justify-center p-5 xl:px-7">
                <div className="hidden items-center gap-2 md:flex">
                    <TournamentStatusBadge status={tournament.status} />
                    <TournamentScopeBadge scope={tournament.participantScope} />
                    <span className="text-xs font-medium text-zinc-500">{tournamentVisibilityText(tournament.visibility, t)}</span>
                </div>
                <Link
                    to={`/tournaments/${tournament.id}`}
                    className="mt-3 w-fit max-w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                >
                    <h2 className="truncate text-lg font-bold tracking-[-0.015em] text-zinc-100 transition-colors group-hover:text-emerald-300 xl:text-xl">
                        {tournament.name}
                    </h2>
                </Link>
                <p className="mt-1.5 line-clamp-1 text-sm text-zinc-400">
                    {tournament.description || t('tournaments.public.noDescription')}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-zinc-500" />
                        {dateRange || t('tournaments.public.datesToBeConfirmed')}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 text-zinc-500" />
                        {t('tournaments.public.entryCount', { count: tournament.entryCount })}
                    </span>
                    {hostName ? <span>{t('tournaments.public.hostedBy', { name: hostName })}</span> : null}
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] p-5 md:flex-col md:items-stretch md:justify-center md:border-l md:border-t-0">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                        {t('tournaments.public.registration')}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-zinc-300">
                        {registrationClose
                            ? t('tournaments.public.registrationCloses', { date: registrationClose })
                            : t('tournaments.public.seeEventDetails')}
                    </p>
                </div>
                <div className="flex items-center gap-2 md:mt-3">
                    {canRegister ? (
                        isRegistered ? (
                            <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
                                <Check className="h-3.5 w-3.5" />
                                {t('tournaments.public.registered')}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onRegister(tournament.id)}
                                disabled={isRegistering}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-wait disabled:opacity-60"
                            >
                                {isRegistering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                {t('tournaments.public.register')}
                            </button>
                        )
                    ) : null}
                    <Link
                        to={`/tournaments/${tournament.id}`}
                        aria-label={t('tournaments.public.viewNamedTournament', { name: tournament.name })}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-zinc-300 transition hover:border-emerald-400/30 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </article>
    );
};
