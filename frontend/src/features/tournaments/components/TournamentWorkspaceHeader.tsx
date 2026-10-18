import { Link } from 'react-router-dom';
import { Building2, CalendarDays, ExternalLink, Pencil, Play, RefreshCw, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, ButtonLink, PageHeader } from '../../../design/primitives';
import { MatchHistoryLink } from '../../matchHistory/MatchHistoryLink';
import { isExtensionCapabilityAvailable } from '../../capabilities/extensions';
import { formatTournamentDateRange, tournamentStatusLabel, tournamentVisibilityText } from '../../../components/tournaments/tournamentFormatters';
import type { TournamentDetail } from '../domain';
import type { TournamentWorkspaceSection } from './TournamentOverview';
import type { getTournamentStartBlockers } from '../startBlockers';

type Blocker = ReturnType<typeof getTournamentStartBlockers>[number];

/**
 * The tournament's name, organiser, dates and status, with its actions: refresh, the public page, results,
 * editing, and starting or finishing. A start that is not yet possible lists every reason beside the button.
 */
export function TournamentWorkspaceHeader({ tournament, timezone, canEdit, legacy, busy, refreshing, finishBlocked, startBlockers, onRefresh, onEdit, onStart, onFinish, onSection }: {
    tournament: TournamentDetail; timezone?: string; canEdit: boolean; legacy: boolean | null; busy: boolean; refreshing: boolean; finishBlocked: boolean; startBlockers: Blocker[];
    onRefresh: () => void; onEdit: () => void; onStart: () => void; onFinish: () => void; onSection: (section: TournamentWorkspaceSection) => void;
}) {
    const { t, i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    const id = tournament.id;
    const open = (target: Blocker['target']) => target === 'settings' ? onEdit() : onSection(target);
    const openLabel = (target: Blocker['target']) => target === 'settings' ? copy('Open settings', 'პარამეტრების გახსნა') : target === 'participants' ? copy('Open participants', 'მონაწილეების გახსნა')
        : target === 'schedule' ? copy('Open Matchday', 'მატჩების დღის გახსნა') : copy('Open Competition', 'შეჯიბრების გახსნა');
    const meta = <span className="tws-meta">
        <Link className="tws-meta__link" to={`/organizations/${tournament.organizerOrganizationId}`}><Building2 aria-hidden="true" />{tournament.organizerName || copy('Tournament organization', 'ტურნირის ორგანიზაცია')}</Link>
        <span className="tws-meta__item"><CalendarDays aria-hidden="true" />{formatTournamentDateRange(tournament.startDate, tournament.endDate, i18n.language, timezone)}{timezone && ` · ${timezone}`}</span>
        <Badge tone={tournament.status === 'ACTIVE' ? 'accent' : tournament.status === 'PLANNING' ? 'info' : 'neutral'}>{tournamentStatusLabel(tournament.status, t)}</Badge>
        <Badge>{tournamentVisibilityText(tournament.visibility, t)}</Badge>
    </span>;
    const actions = <>
        <Button variant="ghost" iconOnly disabled={refreshing} aria-label={copy('Refresh tournament', 'ტურნირის განახლება')} onClick={onRefresh}><RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} /></Button>
        <ButtonLink variant="ghost" to={`/tournaments/${id}`}><ExternalLink aria-hidden="true" />{copy('View tournament', 'ტურნირის ნახვა')}</ButtonLink>
        <MatchHistoryLink tournamentId={id} className="gk-btn gk-btn--ghost" />
        {isExtensionCapabilityAvailable('volunteerShifts') && <ButtonLink variant="ghost" to={`/volunteering?tournamentId=${id}&view=manage`}>{copy('Volunteer shifts', 'მოხალისეთა ცვლები')}</ButtonLink>}
        {canEdit && <Button onClick={onEdit}><Pencil aria-hidden="true" />{tournament.status === 'PLANNING' ? copy('Edit tournament', 'ტურნირის რედაქტირება') : copy('Tournament details', 'ტურნირის დეტალები')}</Button>}
        {canEdit && tournament.status === 'PLANNING' && <Button variant="primary" aria-describedby={startBlockers.length ? 'tournament-start-blockers' : undefined} disabled={busy || startBlockers.length > 0} onClick={onStart}><Play aria-hidden="true" />{copy('Start tournament', 'ტურნირის დაწყება')}</Button>}
        {canEdit && tournament.status === 'ACTIVE' && legacy === true && <Button variant="primary" aria-describedby={finishBlocked ? 'tournament-tie-blocker' : undefined} disabled={busy || finishBlocked} onClick={onFinish}><Trophy aria-hidden="true" />{copy('Finish tournament', 'ტურნირის დასრულება')}</Button>}
        {canEdit && tournament.status === 'ACTIVE' && legacy === false && <Button variant="primary" onClick={() => onSection('bracket')}>{copy('Review season outcome', 'სეზონის შედეგის განხილვა')}</Button>}
    </>;
    return <>
        <PageHeader title={tournament.name} subtitle={meta} actions={actions} className="tws-header" />
        {canEdit && tournament.status === 'PLANNING' && startBlockers.length > 0 && <div id="tournament-start-blockers" className="gk-notice gk-notice--warning tws-blockers">
            <div className="tws-blockers__text"><strong>{startBlockers.length} {copy(startBlockers.length === 1 ? 'check before starting' : 'checks before starting', 'შემოწმება დაწყებამდე')}</strong>
                <ul>{startBlockers.map(blocker => <li key={blocker.key}><span>{blocker.message}</span> <Button size="sm" variant="ghost" onClick={() => open(blocker.target)}>{openLabel(blocker.target)}</Button></li>)}</ul></div>
        </div>}
    </>;
}
