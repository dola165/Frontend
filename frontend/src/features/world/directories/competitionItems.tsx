import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Badge, Button, FixtureRow, ListRow } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { setTournamentHostFollow } from '../../tournaments/api';
import type { TournamentHost, TournamentInvitationInboxItem, TournamentSummary } from '../../tournaments/domain';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { COMPETITION_STATUS, dateColumn, SCOPE_LABEL } from '../format';

/** A competition the person runs or plays in; one they manage opens its workspace. */
export function MyCompetitionRow({ item }: { item: TournamentSummary }) {
    const t = useWorldCopy();
    const { user } = useAuth();
    const managed = user?.navigationCapabilities?.workspaces.some(w => w.id === 'tournament.workspace' && w.context.id === item.id);
    const badge = COMPETITION_STATUS[item.status] ?? COMPETITION_STATUS.PLANNING;
    return (
        <FixtureRow tone="event" to={managed ? `/tournaments/${item.id}/workspace` : `/tournaments/${item.id}`} title={item.name} {...dateColumn(item.startDate)}
            meta={[t(SCOPE_LABEL[item.participantScope] ?? ''), item.hostClubName || item.organizerName, plural(item.entryCount, 'entry', 'entries'), managed ? t('You run this competition') : null].filter(Boolean).join(' · ')}
            trail={<Badge tone={badge.tone}>{t(badge.label)}</Badge>} />
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
    const follow = async () => {
        if (status !== 'authenticated') return navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
        setBusy(true);
        try { setFollowing((await setTournamentHostFollow(host.kind, host.id, !following)).following); setError(''); }
        catch (cause) { setError(extractApiErrorMessage(cause, t('Following could not be updated.'))); }
        finally { setBusy(false); }
    };
    return (
        <li>
            <div className="gk-list-row">
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
        <ListRow to="/requests" lead={<Crest name={item.tournamentName} size={40} />} title={item.tournamentName}
            meta={[item.squadName || item.clubName || t('You, as a player'), t(SCOPE_LABEL[item.participantScope] ?? ''), item.tournamentStatus === 'PLANNING' ? t('In preparation') : t('Already started or finished')].filter(Boolean).join(' · ')}
            trail={<><span className="gk-world-row-note">{t('Answer in your inbox')}</span><Badge tone="warning">{t('Invited')}</Badge></>} />
    );
}
