import { useMatchCopy } from '../copy';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, List, ListRow, Panel, Section, type BadgeTone } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { label, post, type Match } from '../api';
import { useAction } from '../hooks';
import { RefereeInvite } from './RefereeInvite';
import { RefereeRequest } from './RefereeRequest';

const APPOINTMENT: Record<string, { label: string; tone: BadgeTone }> = {
    INVITED: { label: 'Invited', tone: 'info' }, ACCEPTED: { label: 'Accepted', tone: 'accent' }, DECLINED: { label: 'Declined', tone: 'neutral' },
    WITHDRAWN: { label: 'Withdrew', tone: 'danger' }, CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

/**
 * The match officials: who is invited or appointed, and (for the arranging team) inviting or recruiting one. A
 * competition match's referees are the competition's own appointments: shown, never invited here (fix round 1).
 */
export function Officials({ match: m, active, reload }: { match: Match; active: boolean; reload: () => void }) {
    const t = useMatchCopy();
    const { run, busy, feedback } = useAction(reload);
    if (m.origin === 'COMPETITION') return <CompetitionOfficials match={m} />;
    const others = (m.appointments ?? []).filter(a => !m.own_appointments?.some(own => own.id === a.id));
    const manage = Boolean(m.can_arrange_official && active);
    // Whether a referee is invited or appointed, the viewer's own appointment included: then one is no longer
    // "still needed" (fix round 1).
    const own = m.own_appointments ?? [];
    const empty = m.external_referee_name ? t('{name} (arranged outside GrassKickZ)', { name: m.external_referee_name })
        : own.some(a => a.status === 'ACCEPTED') ? t("You referee this match")
        : own.some(a => a.status === 'INVITED') ? t("You are invited to referee this match")
        : m.referee_status === 'ACCEPTED' ? t("A referee is appointed")
        : m.referee_status === 'INVITED' ? t("A referee is invited")
        : m.referee_required ? t("A referee is still needed") : t("No referee is needed for this match");
    const waiting = !m.external_referee_name && !own.length && m.referee_required && !['ACCEPTED', 'INVITED'].includes(m.referee_status);
    return (
        <Section title={t("Match officials")} id="officials">
            <Panel flush>
                {others.length ? <List label={t("Match officials")}>{others.map(a => {
                    const state = APPOINTMENT[a.status] ?? { label: label(a.status), tone: 'neutral' as BadgeTone };
                    return <ListRow key={a.id} lead={<Crest name={a.full_name ?? t("Referee")} size={40} round />}
                        title={<Link className="gk-match-link" to={`/profile/${a.referee_id}`} id={`appointment-${a.id}`}>{a.full_name}</Link>}
                        meta={[t(label(a.duty)), a.volunteer ? t("Volunteering") : a.fee != null ? t('{fee} {currency}, agreed directly', { fee: a.fee, currency: a.currency ?? '' }) : t("Paid appointment"), a.attendance_issue ? t('Unable to attend: {reason}', { reason: a.attendance_issue }) : null].filter(Boolean).join(' · ')}
                        trail={<><Badge tone={a.attendance_issue ? 'danger' : state.tone}>{a.attendance_issue ? t("Replacement needed") : t(state.label)}</Badge>
                            {manage && ['INVITED', 'ACCEPTED'].includes(a.status) && <Button size="sm" disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/referees/${a.id}/cancel`), t("Appointment cancelled"))}>{t("Cancel invitation")}</Button>}</>} />;
                })}</List>
                    : <EmptyNote title={empty}>
                        {m.external_referee_name ? t("Reported by the coaching team; not a GrassKickZ appointment.") : waiting ? (manage ? t("Invite one directly or publish a request referees can answer.") : t("The arranging team invites the referee.")) : undefined}
                    </EmptyNote>}
                {others.some(a => a.report) && <div className="gk-match-reports">{others.filter(a => a.report).map(a => <details key={a.id} className="gk-match-disclosure"><summary>{t('Match report from {name}', { name: a.full_name ?? t('Referee') })}</summary><p>{a.report}</p></details>)}</div>}
            </Panel>
            <div className="gk-mx gk-match-feedback">{feedback}</div>
            {manage && m.referee_required && <RefereeRequest match={m} reload={reload} />}
            {manage && <RefereeInvite match={m} reload={reload} />}
        </Section>
    );
}

/** A competition match's referees, as the competition appointed them; the organiser appoints, nobody invites here. */
function CompetitionOfficials({ match: m }: { match: Match }) {
    const t = useMatchCopy();
    const referees = m.competition_referees ?? [];
    return (
        <Section title={t("Match officials")} id="officials">
            <Panel flush>
                {referees.length ? <List label={t("Match officials")}>{referees.map(a => {
                    const state = APPOINTMENT[a.status] ?? { label: label(a.status), tone: 'neutral' as BadgeTone };
                    const name = a.full_name ?? t('Referee');
                    return <ListRow key={a.id} lead={<Crest name={name} size={40} round />}
                        title={a.referee_id && a.full_name ? <Link className="gk-match-link" to={`/profile/${a.referee_id}`}>{name}</Link> : name}
                        meta={m.competition_name ? t('Appointed by {competition}', { competition: m.competition_name }) : undefined}
                        trail={<Badge tone={state.tone}>{t(state.label)}</Badge>} />;
                })}</List>
                    : <EmptyNote title={t("The competition appoints the referee")} />}
            </Panel>
        </Section>
    );
}
