import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Button, ListRow } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { structureLabels, type CompetitionCard } from '../../competitions/api';
import { setTournamentHostFollow } from '../../tournaments/api';
import type { TournamentHost, TournamentInvitationInboxItem, TournamentSummary } from '../../tournaments/domain';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { DateLead, ResultRow } from '../directory/ResultRow';
import { counterpartProps, useMapCounterpart } from '../directory/selection';
import { peekOf } from '../peek/usePeek';
import { codeLabel, COMPETITION_STATUS, dateColumn, entryState, SCOPE_LABEL } from '../format';

/**
 * A competition as a row: its first day where a crest would be, its name (to its page), what it is (age, format,
 * structure, who enters) and who runs it where with the places taken, and whether entries are open. It shows beside the
 * list.
 */
export function CompetitionItem({ item: card }: { item: CompetitionCard & { registrationClosesAt?: string | null } }) {
    const t = useWorldCopy();
    const rules = card.profile?.rules;
    const date = dateColumn(card.startDate), state = entryState(card.status, card.registrationClosesAt);
    const capacity = card.entryCap ? t('{count} of {cap} places taken', { count: card.entryCount, cap: card.entryCap }) : card.entryCount ? t('{count} entered', { count: card.entryCount }) : null;
    return (
        <ResultRow lead={<DateLead top={date.time} bottom={date.day} />} title={card.name} to={`/tournaments/${card.id}`} peek={peekOf('tournament', card.id)}
            lines={[
                [rules && codeLabel(rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`, rules && t(structureLabels[rules.structure]), t(SCOPE_LABEL[card.participantScope] ?? '')].filter(Boolean).join(' · '),
                [card.hostClubName || card.organizerName, rules?.city, capacity].filter(Boolean).join(' · '),
            ]}
            aside={<Status tone={state.tone}>{state.label}</Status>} />
    );
}

/** A competition the person runs or plays in: one they play in shows beside the list, one they manage opens its workspace. */
export function MyCompetitionRow({ item }: { item: TournamentSummary }) {
    const t = useWorldCopy();
    const { user } = useAuth();
    const managed = user?.navigationCapabilities?.workspaces.some(w => w.id === 'tournament.workspace' && w.context.id === item.id);
    const badge = COMPETITION_STATUS[item.status] ?? COMPETITION_STATUS.PLANNING;
    const date = dateColumn(item.startDate);
    return (
        <ResultRow lead={<DateLead top={date.time} bottom={date.day} />} title={item.name} to={managed ? `/tournaments/${item.id}/workspace` : `/tournaments/${item.id}`}
            peek={managed ? undefined : peekOf('tournament', item.id)}
            lines={[
                [t(SCOPE_LABEL[item.participantScope] ?? ''), item.hostClubName || item.organizerName, plural(item.entryCount, 'entry', 'entries')].filter(Boolean).join(' · '),
                managed ? t('You run this competition') : null,
            ]}
            aside={<Status tone={badge.tone}>{t(badge.label)}</Status>} />
    );
}

/** An organiser of competitions, with Follow. */
export function HostRow({ item: host }: { item: TournamentHost }) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [following, setFollowing] = useState(host.following);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const counterpart = useMapCounterpart();
    const follow = async () => {
        if (status !== 'authenticated') return navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
        setBusy(true);
        try { setFollowing((await setTournamentHostFollow(host.kind, host.id, !following)).following); setError(''); }
        catch (cause) { setError(extractApiErrorMessage(cause, t('Following could not be updated.'))); }
        finally { setBusy(false); }
    };
    return (
        <li>
            <div className="gk-list-row" {...counterpartProps(counterpart)}>
                <span className="gk-list-row__lead"><Crest src={host.logoUrl} name={host.name} size={40} /></span>
                <span className="gk-list-row__main">
                    <Link className="gk-list-row__title gk-world-link" to={`/world/competitions?host=${host.kind}:${host.id}`}>{host.name}</Link>
                    <span className="gk-list-row__meta">{host.kind === 'CLUB' ? t('Club') : t('Organisation')} · {plural(host.tournamentCount, 'competition')}{error && <span role="alert" className="gk-world-more__error"> · {error}</span>}</span>
                </span>
                <span className="gk-list-row__trail">
                    <Button size="sm" aria-pressed={following} disabled={busy} onClick={follow}>{following ? <><Check aria-hidden="true" />{t('Following')}</> : <><Plus aria-hidden="true" />{t('Follow')}</>}</Button>
                </span>
            </div>
        </li>
    );
}

/** An invitation to enter a competition; it is answered in the inbox. */
export function InvitationRow({ item }: { item: TournamentInvitationInboxItem }) {
    const t = useWorldCopy();
    return (
        <ListRow to="/requests" {...useMapCounterpart()} lead={<Crest name={item.tournamentName} size={40} />} title={item.tournamentName}
            meta={[item.squadName || item.clubName || t('You, as a player'), t(SCOPE_LABEL[item.participantScope] ?? ''), item.tournamentStatus === 'PLANNING' ? t('In preparation') : t('Already started or finished')].filter(Boolean).join(' · ')}
            trail={<><span className="gk-world-row-note">{t('Answer in your inbox')}</span><Status tone="warning">{t('Invited')}</Status></>} />
    );
}
