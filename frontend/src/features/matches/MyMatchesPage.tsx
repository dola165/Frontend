import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Flag } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, GkRoot, List, ListRow, LoadFailed, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../design/primitives';
import { Status } from '../../design/DataTable';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ActivityBadge } from '../clubWorkspace/coachHub/CoachVisuals';
import { post, type Appointment, type RefereeHub } from '../matchExchange/api';
import { useAction, useClock, useLoad } from '../matchExchange/hooks';
import { refereeStage } from '../refereeWorkspace/domain';
import { matchPath } from './matchContext';
import './match-page.css';

type OpenRequest = { event_id: number; event_type?: string | null; title: string; location_name: string | null; starts_at_iso: string; ends_at_iso: string; volunteer: boolean; fee: number | null; currency: string | null; revision: number; application_status: string | null };

// Every match is green: a trophy for a league, cup or competition match, a handshake for a friendly.
const symbol = (type?: string | null) => type === 'MATCH' ? 'MATCH' as const : 'FRIENDLY' as const;
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * A referee's own matches, their place in the top bar (step 6): invitations to answer, matches coming up, reports to
 * write, matches nearby that need a referee (one tap offers), and what they refereed. Each opens the one match page
 * in this context ("← My matches"). The referee profile and availability stay in the referee workspace.
 */
export default function MyMatchesPage() {
    const copy = useJourneyCopy();
    const now = useClock();
    const { data: hub, error, reload } = useLoad<RefereeHub>('/referees/me');
    const { data: requests, reload: reloadRequests } = useLoad<OpenRequest[]>('/match-arrangements/official-requests');
    const { run, busy, feedback } = useAction(() => { reload(); reloadRequests(); });
    const [more, setMore] = useState(false);
    const header = <PageHeader title={copy('My matches', 'ჩემი მატჩები')} actions={<ButtonLink variant="ghost" to="/referees/me">{copy('Referee profile', 'მსაჯის პროფილი')}</ButtonLink>} />;
    if (error && !hub) return <GkRoot className="gk-page"><PageFrame>{header}<LoadFailed text={copy('Your matches couldn’t load', 'თქვენი მატჩები ვერ ჩაიტვირთა')} retry={copy('Try again', 'ხელახლა ცდა')} onRetry={reload} /></PageFrame></GkRoot>;
    if (!hub) return <GkRoot className="gk-page"><PageFrame>{header}<div className="gk-stack" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={120} /><Skeleton height={180} /></div></PageFrame></GkRoot>;
    const stage = (name: string) => hub.appointments.filter(a => refereeStage(a, now) === name).sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
    const invitations = stage('invitations'), upcoming = stage('upcoming'), reports = stage('follow-ups');
    const played = stage('history').filter(a => a.status === 'ACCEPTED').sort((a, b) => Date.parse(b.starts_at_iso) - Date.parse(a.starts_at_iso));
    const nearby = (requests ?? []).filter(r => !hub.appointments.some(a => a.event_id === r.event_id));
    const row = (a: Appointment, state: { word: string; tone: 'warning' | 'accent' | 'neutral' | 'danger' }) =>
        <ListRow key={a.id} to={matchPath(a.event_id, { kind: 'referee' }, a.status === 'INVITED' ? `#appointment-${a.id}` : '')} lead={<ActivityBadge kind={symbol(a.event_type)} size={32} />}
            title={[a.club_name, a.opponent_name].filter(Boolean).join(' v ') || a.title} meta={[when(a.starts_at_iso), a.location_name, a.duty === 'REFEREE' ? null : copy('Assistant', 'ასისტენტი')].filter(Boolean).join(' · ')}
            trail={<><Status tone={state.tone}>{state.word}</Status><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
    const section = (title: string, items: Appointment[], state: { word: string; tone: 'warning' | 'accent' | 'neutral' | 'danger' }) => items.length > 0 &&
        <Section boxed title={title} hint={`${items.length}`}><Panel flush><List label={title}>{items.map(a => row(a, state))}</List></Panel></Section>;
    return <GkRoot className="gk-page"><PageFrame>
        {header}
        <div className="gk-stack">
            {section(copy('To answer', 'პასუხი გჭირდებათ'), invitations, { word: copy('Invited', 'მოწვეული'), tone: 'warning' })}
            {section(copy('Reports to write', 'დასაწერი ანგარიშები'), reports, { word: copy('Report due', 'ანგარიში ელოდება'), tone: 'warning' })}
            {section(copy('Coming up', 'მომავალი'), upcoming, { word: copy('Accepted', 'დადასტურებული'), tone: 'accent' })}
            {nearby.length > 0 && <Section boxed icon={Flag} title={copy('Matches that need a referee', 'მატჩები, რომლებსაც მსაჯი სჭირდება')} hint={`${nearby.length}`}>
                {/* The title opens the match; the offer is its own button (never a button inside a link). */}
                <Panel flush><List label={copy('Matches that need a referee', 'მატჩები, რომლებსაც მსაჯი სჭირდება')}>{nearby.map(r => <ListRow key={r.event_id}
                    lead={<ActivityBadge kind={symbol(r.event_type)} size={32} />} title={<Link className="gk-match-link" to={matchPath(r.event_id, { kind: 'referee' })}>{r.title}</Link>}
                    meta={[when(r.starts_at_iso), r.location_name, r.volunteer ? copy('Volunteer', 'მოხალისე') : `${r.fee ?? 0} ${r.currency ?? 'GEL'}`].filter(Boolean).join(' · ')}
                    trail={r.application_status === 'PENDING' ? <Status tone="neutral">{copy('Offer sent', 'შეთავაზება გაგზავნილია')}</Status>
                        : <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${r.event_id}/official-request/apply`, { revision: r.revision }), copy('Offer sent to the club', 'შეთავაზება კლუბს გაეგზავნა'))}>
                            {copy('Offer to referee', 'მსაჯობის შეთავაზება')}</Button>} />)}</List></Panel>
                <div className="gk-mx gk-match-feedback">{feedback}</div>
            </Section>}
            {!invitations.length && !reports.length && !upcoming.length && !nearby.length && <EmptyNote title={copy('No matches yet', 'მატჩები ჯერ არ არის')}>
                {copy('Clubs invite you from the match page; matches nearby that ask for a referee appear here.', 'კლუბები მატჩის გვერდიდან გიწვევენ; ახლომდებარე მატჩები, რომლებსაც მსაჯი სჭირდება, აქ გამოჩნდება.')}</EmptyNote>}
            {played.length > 0 && <Section boxed title={copy('Refereed', 'ნამსაჯი')} hint={`${played.length}`}>
                <Panel flush><List label={copy('Refereed', 'ნამსაჯი')}>{(more ? played : played.slice(0, 8)).map(a => row(a, { word: copy('Refereed', 'ნამსაჯი'), tone: 'neutral' }))}</List></Panel>
                {played.length > 8 && !more && <Button size="sm" variant="ghost" onClick={() => setMore(true)}>{copy(`Show all ${played.length}`, `ყველა ${played.length}-ის ჩვენება`)}</Button>}
            </Section>}
        </div>
    </PageFrame></GkRoot>;
}
