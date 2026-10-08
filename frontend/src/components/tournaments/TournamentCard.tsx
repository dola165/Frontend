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
        <article className="group flex min-h-full flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)]/[0.07] bg-[var(--color-surface)] shadow-[0_18px_50px_color-mix(in_srgb,_var(--color-shadow)_12%,_transparent)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-accent)]/30 hover:shadow-[0_22px_60px_color-mix(in_srgb,_var(--color-shadow)_24%,_transparent)] focus-within:border-[color:var(--color-accent)]/40">
            <TournamentVisual name={tournament.name} imageUrl={tournament.bannerImageUrl} className="h-44">
                <div className="flex h-full flex-col justify-between p-4">
                    <div className="flex items-start justify-between gap-2">
                        <TournamentStatusBadge status={tournament.status} />
                        <TournamentScopeBadge scope={tournament.participantScope} />
                    </div>
                    <div className="flex items-end justify-between gap-3 text-xs text-[color:var(--color-secondary)]">
                        <span className="truncate font-medium">{hostName ? t('tournaments.public.hostedBy', { name: hostName }) : t('tournaments.public.independentEvent')}</span>
                        <span className="shrink-0 rounded-full border border-[color:var(--color-border)]/10 bg-[color:var(--color-ink)]/30 px-2.5 py-1 backdrop-blur-sm">
                            {tournamentVisibilityText(tournament.visibility, t)}
                        </span>
                    </div>
                </div>
            </TournamentVisual>

            <div className="flex flex-1 flex-col p-5">
                <Link
                    to={`/tournaments/${tournament.id}`}
                    className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/70"
                >
                    <h2 className="text-lg font-bold tracking-[-0.015em] text-[color:var(--color-text)] transition-colors group-hover:text-[color:var(--color-accent)]">
                        {tournament.name}
                    </h2>
                </Link>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[color:var(--color-muted)]">
                    {tournament.description || t('tournaments.public.noDescription')}
                </p>

                <div className="mt-5 space-y-2.5 border-t border-[color:var(--color-border)]/[0.06] pt-4 text-xs text-[color:var(--color-muted)]">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-[color:var(--color-muted)]" />
                        <span>{dateRange || t('tournaments.public.datesToBeConfirmed')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-[color:var(--color-muted)]" />
                        <span>{t('tournaments.public.entryCount', { count: tournament.entryCount })}</span>
                        {registrationClose ? (
                            <span className="ml-auto truncate text-[color:var(--color-muted)]">
                                {t('tournaments.public.registrationClosesShort', { date: registrationClose })}
                            </span>
                        ) : null}
                    </div>
                </div>

                {tournament.incentives ? (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color:var(--color-warning)]/15 bg-[color:var(--color-warning)]/[0.06] px-3 py-2.5 text-xs text-[color:var(--color-warning)]/80">
                        <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-warning)]" />
                        <span className="line-clamp-1">{tournament.incentives.split('|')[0]}</span>
                    </div>
                ) : null}

                <div className="mt-auto flex items-center gap-3 pt-5">
                    <Link
                        to={`/tournaments/${tournament.id}`}
                        className="inline-flex flex-1 items-center gap-1.5 text-sm font-semibold text-[color:var(--color-text)] outline-none transition-colors hover:text-[color:var(--color-accent)] focus-visible:text-[color:var(--color-accent)]"
                    >
                        {t('tournaments.public.viewDetails')}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    {canRegister ? (
                        isRegistered ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/10 px-3.5 py-2 text-xs font-bold text-[color:var(--color-accent)]">
                                <Check className="h-3.5 w-3.5" />
                                {t('tournaments.public.registered')}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onRegister(tournament.id)}
                                disabled={isRegistering}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-accent)] px-3.5 py-2 text-xs font-bold text-[color:var(--color-on-accent)] shadow-lg shadow-[var(--color-shadow)]/20 transition hover:bg-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] disabled:cursor-wait disabled:opacity-60"
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
