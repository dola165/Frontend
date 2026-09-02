import { Link } from 'react-router-dom';
import { ArrowRight, Award, CalendarDays, Check, Loader2, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TournamentSummary } from '../../features/tournaments/domain';
import {
    TournamentScopeBadge,
    TournamentStatusBadge,
    TournamentVisual,
} from './TournamentPresentation';
import { formatTournamentDate, formatTournamentDateRange, tournamentVisibilityText } from './tournamentFormatters';

interface TournamentCardProps {
    tournament: TournamentSummary;
    isRegistered: boolean;
    isRegistering: boolean;
    onRegister: (tournamentId: number) => void;
}

export const TournamentCard = ({
    tournament,
    isRegistered,
    isRegistering,
    onRegister,
}: TournamentCardProps) => {
    const { t, i18n } = useTranslation();
    const dateRange = formatTournamentDateRange(tournament.startDate, tournament.endDate, i18n.language);
    const registrationClose = formatTournamentDate(tournament.registrationClosesAt, i18n.language);
    const hostName = tournament.hostClubName ?? tournament.organizerName;
    const canRegister = tournament.participantScope === 'PLAYER' && tournament.status === 'PLANNING';

    return (
        <article className="group flex min-h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#15181c] shadow-[0_18px_50px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:shadow-[0_22px_60px_rgba(0,0,0,0.24)] focus-within:border-emerald-400/40">
            <TournamentVisual name={tournament.name} imageUrl={tournament.bannerImageUrl} className="h-44">
                <div className="flex h-full flex-col justify-between p-4">
                    <div className="flex items-start justify-between gap-2">
                        <TournamentStatusBadge status={tournament.status} />
                        <TournamentScopeBadge scope={tournament.participantScope} />
                    </div>
                    <div className="flex items-end justify-between gap-3 text-xs text-zinc-300">
                        <span className="truncate font-medium">{hostName ? t('tournaments.public.hostedBy', { name: hostName }) : t('tournaments.public.independentEvent')}</span>
                        <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 backdrop-blur-sm">
                            {tournamentVisibilityText(tournament.visibility, t)}
                        </span>
                    </div>
                </div>
            </TournamentVisual>

            <div className="flex flex-1 flex-col p-5">
                <Link
                    to={`/tournaments/${tournament.id}`}
                    className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                >
                    <h2 className="text-lg font-bold tracking-[-0.015em] text-zinc-100 transition-colors group-hover:text-emerald-300">
                        {tournament.name}
                    </h2>
                </Link>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-400">
                    {tournament.description || t('tournaments.public.noDescription')}
                </p>

                <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span>{dateRange || t('tournaments.public.datesToBeConfirmed')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span>{t('tournaments.public.entryCount', { count: tournament.entryCount })}</span>
                        {registrationClose ? (
                            <span className="ml-auto truncate text-zinc-500">
                                {t('tournaments.public.registrationClosesShort', { date: registrationClose })}
                            </span>
                        ) : null}
                    </div>
                </div>

                {tournament.incentives ? (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2.5 text-xs text-amber-100/80">
                        <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <span className="line-clamp-1">{tournament.incentives.split('|')[0]}</span>
                    </div>
                ) : null}

                <div className="mt-auto flex items-center gap-3 pt-5">
                    <Link
                        to={`/tournaments/${tournament.id}`}
                        className="inline-flex flex-1 items-center gap-1.5 text-sm font-semibold text-zinc-200 outline-none transition-colors hover:text-emerald-300 focus-visible:text-emerald-300"
                    >
                        {t('tournaments.public.viewDetails')}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    {canRegister ? (
                        isRegistered ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2 text-xs font-bold text-emerald-300">
                                <Check className="h-3.5 w-3.5" />
                                {t('tournaments.public.registered')}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onRegister(tournament.id)}
                                disabled={isRegistering}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-wait disabled:opacity-60"
                            >
                                {isRegistering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                {t('tournaments.public.register')}
                            </button>
                        )
                    ) : null}
                </div>
            </div>
        </article>
    );
};
