import { CalendarDays, MapPin, MessageCircle, Shield, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, ButtonLink, List, ListRow, Panel, Section } from '../../../design/primitives';
import type { ConversationDto } from '../../../api/chat';
import { post, type Match } from '../api';
import { journeyLabel } from '../journeyCopy';
import { useWorldCopy } from '../../world/copy';
import { appLanguage } from '../../../utils/formatting';
import { useAction } from '../hooks';
import { canUseReservation, endTime, groundState, holdsGround, hostingText, kickoffDay, kickoffTime, lengthMinutes, refereeState } from './matchState';

const sideName = (squad: string, club: string | null, same: boolean) => same && club ? `${squad} (${club})` : squad;

/**
 * Plan your match day: when, where, who referees, the squads and the conversation. Each line says where it stands in
 * words; either club confirms an unlisted ground here once its owner has agreed, or uses a reservation (`onReserve`).
 */
export function MatchDayPlan({ match: m, active, conversation, reload, onReserve }: { match: Match; active: boolean; conversation?: ConversationDto | null; reload: () => void; onReserve: () => void }) {
    const t = useWorldCopy();
    const language = appLanguage();
    const ground = groundState(m);
    const referee = refereeState(m);
    const confirm = useAction(reload);
    const same = m.squad_name === m.opponent_squad_name;
    const named = m.location_name && !/to be (arranged|agreed|confirmed)/i.test(m.location_name);
    // Either club that arranges the match may confirm an unlisted ground, as the backend allows.
    const canConfirmGround = m.can_arrange && active && !m.venue_id && !m.booking_id && named;
    const reservation = !m.booking ? null : m.booking.status === 'CONFIRMED' ? t('Reserved') : m.booking.status === 'PENDING' ? t('Reservation waiting for the venue')
        : holdsGround(m) ? t('Reservation request expired; the venue has not released it yet') : t('Reservation {status}', { status: journeyLabel(m.booking.status, language) });
    const canReserve = canUseReservation(m, active);
    const appointed = m.appointments?.filter(a => ['ACCEPTED', 'INVITED'].includes(a.status)).map(a => a.full_name).filter(Boolean).join(', ');
    return (
        <Section title={t('Plan your match day')} id="plan">
            <Panel flush>
                <List label={t('Match day')}>
                    <ListRow lead={<CalendarDays aria-hidden="true" className="gk-match-icon" />}
                        title={<>{kickoffDay(m)} · <span className="gk-num">{kickoffTime(m)}–{endTime(m)}</span></>}
                        meta={t('{minutes} minutes · {timezone}', { minutes: lengthMinutes(m), timezone: m.timezone })}
                        trail={<ButtonLink size="sm" variant="ghost" to={`/calendar?scope=squad&squadId=${m.squad_id}`}>{t('Squad schedule')}</ButtonLink>} />
                    <ListRow lead={<MapPin aria-hidden="true" className="gk-match-icon" />}
                        title={named ? m.location_name : t('Ground to be arranged')}
                        meta={[m.city, hostingText(m), reservation, m.external_venue_confirmed ? t('Confirmed with the ground owner') : null].filter(Boolean).join(' · ')}
                        trail={<>
                            <Badge tone={ground.tone}>{t(ground.label)}</Badge>
                            {m.venue_id && <ButtonLink size="sm" variant="ghost" to={`/stadiums/${m.venue_id}`}>{t('Directions')}</ButtonLink>}
                            {canReserve && <Button size="sm" variant="ghost" data-reserve-opener="" onClick={onReserve}>{t('Use a reservation')}</Button>}
                            {canConfirmGround && <Button size="sm" disabled={confirm.busy}
                                onClick={() => void confirm.run(() => post(`/match-exchange/${m.event_id}/venue`, { bookingId: null, externalConfirmed: !m.external_venue_confirmed, revision: m.revision }), t(m.external_venue_confirmed ? 'Ground confirmation withdrawn' : 'Ground confirmed'))}>
                                {t(m.external_venue_confirmed ? 'Withdraw confirmation' : 'Confirm ground')}</Button>}
                        </>} />
                    <ListRow lead={<Shield aria-hidden="true" className="gk-match-icon" />}
                        title={appointed || m.external_referee_name || t(m.referee_required ? 'Referee' : 'No referee needed')}
                        meta={m.external_referee_name ? t('Arranged outside GrassKickZ by the coaching team') : m.referee_responsibility === 'OPPONENT' ? t('The visiting team arranges the referee') : m.referee_required ? t('The hosting team arranges the referee') : undefined}
                        trail={<><Badge tone={referee.tone}>{t(referee.label)}</Badge>{m.referee_required && <a className="gk-btn gk-btn--ghost gk-btn--sm" href="#officials">{t('See officials')}</a>}</>} />
                    <ListRow lead={<UsersRound aria-hidden="true" className="gk-match-icon" />}
                        title={<><Link className="gk-match-link" to={`/clubs/${m.club_id}?tab=teams&squad=${m.squad_id}`}>{sideName(m.squad_name, m.club_name, same)}</Link>{m.opponent_squad_name && <> v {m.opponent_club_id ? <Link className="gk-match-link" to={`/clubs/${m.opponent_club_id}?tab=teams${m.target_squad_id ? `&squad=${m.target_squad_id}` : ''}`}>{sideName(m.opponent_squad_name, m.opponent_name, same)}</Link> : sideName(m.opponent_squad_name, m.opponent_name, same)}</>}</>}
                        meta={m.coach_name ? <>{t('Host coach:')} {m.head_coach_id ? <Link className="gk-match-link" to={`/profile/${m.head_coach_id}`}>{m.coach_name}</Link> : m.coach_name}</> : t('{club} squads', { club: m.club_name })} />
                    {m.can_arrange && m.listing_status === 'ARRANGED' && conversation !== undefined && <ListRow lead={<MessageCircle aria-hidden="true" className="gk-match-icon" />}
                        title={t('Match conversation')} meta={t(conversation ? 'Both coaching teams' : 'Find it in Messages')}
                        trail={<ButtonLink size="sm" to={conversation ? `/messages?conversationId=${conversation.id}` : '/messages'}>{t(conversation ? 'Open conversation' : 'Open Messages')}</ButtonLink>} />}
                </List>
                {m.description && <p className="gk-match-notes">{m.description}</p>}
            </Panel>
            <div className="gk-mx gk-match-feedback">{confirm.feedback}</div>
        </Section>
    );
}
