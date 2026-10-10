import { Link } from 'react-router-dom';
import { Badge, Panel } from '../../../design/primitives';
import type { ConversationDto } from '../../../api/chat';
import type { Match } from '../api';
import { useJourneyCopy } from '../journeyCopy';
import { groundState, refereeState, type State } from './matchState';

/** Where the arrangement stands (opponent, ground, officials, conversation) and the next step. */
export function Readiness({ match: m, now, conversation }: { match: Match; now: number; conversation?: ConversationDto | null }) {
    const { copy } = useJourneyCopy();
    const next = copy(m.event_status === 'CANCELLED' ? 'cancelled' : m.event_status === 'COMPLETED' ? 'finished'
        : new Date(m.ends_at_iso).getTime() <= now ? 'nextResult'
            : !m.opponent_name ? 'nextOpponent' : m.referee_status === 'REPLACEMENT_NEEDED' ? (new Date(m.starts_at_iso).getTime() <= now ? 'nextHostLate' : 'nextHostReferee')
                : !['BOOKED', 'HOST_CONFIRMED'].includes(m.venue_status) ? 'nextHostVenue'
                    : m.referee_status === 'INVITED' ? 'nextReferee' : m.referee_status === 'NEEDED' ? 'nextHostInvite' : 'ready');
    const opponent: State = m.event_status === 'CANCELLED' ? { label: 'Cancelled', tone: 'danger' } : m.opponent_name ? { label: 'Agreed', tone: 'accent' } : { label: m.requested_club_id ? 'Invited' : 'Needed', tone: 'warning' };
    const closed = m.event_status === 'CANCELLED' || m.event_status === 'COMPLETED';
    const communication = closed ? copy('communicationClosed') : !m.opponent_name ? 'After opponent agreement' : conversation === undefined ? 'Checking…' : conversation ? 'Ready' : 'Available in Messages';
    const rows: [string, State][] = [[copy('opponent'), opponent], [copy('pitchVenue'), groundState(m)], [copy('officials'), refereeState(m)]];
    return (
        <Panel title={copy('readiness')} as="section" className="gk-match-readiness">
            <div className="gk-panel--pad gk-match-readiness__body" role="region" aria-label={copy('readinessRegion')}>
                <p className="gk-match-readiness__next">{next}</p>
                <dl className="gk-match-readiness__rows">
                    {rows.map(([name, state]) => <div key={name}><dt>{name}</dt><dd><Badge tone={state.tone}>{state.label}</Badge></dd></div>)}
                </dl>
                {m.can_arrange && <p className="gk-match-readiness__talk">{copy('communication')}: <strong>{communication}</strong>
                    {m.listing_status === 'ARRANGED' && m.opponent_name && conversation !== undefined && !closed && <> · <Link className="gk-match-link" to={conversation ? `/messages?conversationId=${conversation.id}` : '/messages'}>
                        {conversation ? 'Open the exact match conversation' : 'Open Messages to find this match conversation'}</Link></>}
                </p>}
            </div>
        </Panel>
    );
}
