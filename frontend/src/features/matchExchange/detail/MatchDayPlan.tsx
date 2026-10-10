import { CalendarDays, MapPin, MessageCircle, Shield, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, ButtonLink, List, ListRow, Panel, Section } from '../../../design/primitives';
import type { ConversationDto } from '../../../api/chat';
import { label, post, type Match } from '../api';
import { useAction } from '../hooks';
import { endTime, groundState, hostingText, kickoffDay, kickoffTime, lengthMinutes, refereeState } from './matchState';

/**
 * Plan your match day: when, where, who referees, the squads and the conversation. Each line says
 * where it stands; the host confirms an unlisted ground here once its owner has agreed.
 */
export function MatchDayPlan({ match: m, active, conversation, reload }: { match: Match; active: boolean; conversation?: ConversationDto | null; reload: () => void }) {
    const ground = groundState(m);
    const referee = refereeState(m);
    const confirm = useAction(reload);
    const named = m.location_name && !/to be (arranged|agreed|confirmed)/i.test(m.location_name);
    const canConfirmGround = m.can_manage && active && !m.venue_id && !m.booking_id && named;
    const appointed = m.appointments?.filter(a => ['ACCEPTED', 'INVITED'].includes(a.status)).map(a => a.full_name).filter(Boolean).join(', ');
    return (
        <Section title="Plan your match day" id="plan">
            <Panel flush>
                <List label="Match day">
                    <ListRow lead={<CalendarDays aria-hidden="true" className="gk-match-icon" />}
                        title={<>{kickoffDay(m)} · <span className="gk-num">{kickoffTime(m)}–{endTime(m)}</span></>}
                        meta={`${lengthMinutes(m)} minutes · ${m.timezone}`}
                        trail={<ButtonLink size="sm" variant="ghost" to={`/calendar?scope=squad&squadId=${m.squad_id}`}>Squad schedule</ButtonLink>} />
                    <ListRow lead={<MapPin aria-hidden="true" className="gk-match-icon" />}
                        title={named ? m.location_name : 'Ground to be arranged'}
                        meta={[m.city, hostingText(m), m.booking ? `Reservation #${m.booking.id} · ${label(m.booking.status)}` : null, m.external_venue_confirmed ? 'Confirmed with the ground owner' : null].filter(Boolean).join(' · ')}
                        trail={<>
                            <Badge tone={ground.tone}>{ground.label}</Badge>
                            {m.venue_id && <ButtonLink size="sm" variant="ghost" to={`/stadiums/${m.venue_id}`}>Directions</ButtonLink>}
                            {canConfirmGround && <Button size="sm" disabled={confirm.busy}
                                onClick={() => void confirm.run(() => post(`/match-exchange/${m.event_id}/venue`, { bookingId: null, externalConfirmed: !m.external_venue_confirmed, revision: m.revision }), m.external_venue_confirmed ? 'Ground confirmation withdrawn' : 'Ground confirmed')}>
                                {m.external_venue_confirmed ? 'Withdraw confirmation' : 'Confirm ground'}</Button>}
                        </>} />
                    <ListRow lead={<Shield aria-hidden="true" className="gk-match-icon" />}
                        title={appointed || m.external_referee_name || (m.referee_required ? 'Referee' : 'No referee needed')}
                        meta={m.external_referee_name ? 'Arranged outside GrassKickZ by the coaching team' : m.referee_responsibility === 'OPPONENT' ? 'The visiting team arranges the referee' : m.referee_required ? 'The hosting team arranges the referee' : undefined}
                        trail={<><Badge tone={referee.tone}>{referee.label}</Badge>{m.referee_required && <a className="gk-btn gk-btn--ghost gk-btn--sm" href="#officials">See officials</a>}</>} />
                    <ListRow lead={<UsersRound aria-hidden="true" className="gk-match-icon" />}
                        title={<><Link className="gk-match-link" to={`/clubs/${m.club_id}?tab=teams&squad=${m.squad_id}`}>{m.squad_name}</Link>{m.opponent_squad_name && <> v {m.opponent_club_id ? <Link className="gk-match-link" to={`/clubs/${m.opponent_club_id}?tab=teams`}>{m.opponent_squad_name}</Link> : m.opponent_squad_name}</>}</>}
                        meta={m.coach_name ? <>Host coach: {m.head_coach_id ? <Link className="gk-match-link" to={`/profile/${m.head_coach_id}`}>{m.coach_name}</Link> : m.coach_name}</> : `${m.club_name} squads`} />
                    {m.can_arrange && m.listing_status === 'ARRANGED' && conversation !== undefined && <ListRow lead={<MessageCircle aria-hidden="true" className="gk-match-icon" />}
                        title="Match conversation" meta={conversation ? 'Both coaching teams' : 'Find it in Messages'}
                        trail={<ButtonLink size="sm" to={conversation ? `/messages?conversationId=${conversation.id}` : '/messages'}>{conversation ? 'Open conversation' : 'Open Messages'}</ButtonLink>} />}
                </List>
                {m.description && <p className="gk-match-notes">{m.description}</p>}
            </Panel>
            <div className="gk-mx gk-match-feedback">{confirm.feedback}</div>
        </Section>
    );
}
