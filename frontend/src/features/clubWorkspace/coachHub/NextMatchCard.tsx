import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, ClipboardCheck, Send } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { Crest, FaceStack, type Face } from '../../../design/visuals';
import { useCopy } from '../../../locales/useCopy';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import { officeToolPath } from '../../clubOffice/officeLinks';
import { opponentName } from '../../matchExchange/api';
import { notComing } from '../../matchExchange/callUps';
import { groundState, refereeState } from '../../matchExchange/detail/matchState';
import { matchPath } from '../../matches/matchContext';
import { dayLabel, timeLabel } from '../fixtures';
import { MatchChecklistDialog } from './MatchChecklistDialog';
import { ActivityBadge } from './CoachVisuals';
import type { MatchCard } from './squadApi';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';
import './squad-page.css';

/** Who's coming to the match: a called-up player is expected unless their family said they can't come (step 6). */
function callUpCounts(card: MatchCard) {
    const called = card.callUps ?? [], out = called.filter(notComing).length;
    return { called: called.length, expected: card.expected ?? called.length - out, out: card.notComing ?? out };
}

/**
 * A squad's next match, the same card for everyone on the squad (step 3, 29 October 2026): the fixture, who's coming as
 * faces ringed by whether they are expected, "13 expected · 1 not coming", the checklist (call-ups, referee, pitch,
 * first-aider), the day, what to bring and who's fit as Fit, Doubtful or Out only. The buttons are this person's: call-ups
 * with match management, the checklist with preparation, the bus with travel. Nobody is chased for an answer.
 * `compact` is the one line on a squad's card in My squads.
 */
export function NextMatchCard({ card, data, compact = false, onChanged }: { card: MatchCard; data: CoachData; compact?: boolean; onChanged: () => void }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [checking, setChecking] = useState(false);
    const m = card.match;
    if (!m) return null;
    const ours = m.squad_id === card.squadId || m.club_id === data.clubId;
    const opponent = (ours ? opponentName(m) : m.club_name) ?? copy('opponentToCome');
    const away = ours ? m.venue_preference === 'AWAY' : true;
    const when = `${dayLabel(m.starts_at_iso, data.now)} · ${timeLabel(m.starts_at_iso)} · ${copy(away ? 'away' : 'home')}`;
    const counts = callUpCounts(card), page = matchPath(m.event_id, { kind: 'squad', id: card.squadId });
    // Not coming first, then everyone expected.
    const faces: Face[] = (card.callUps ?? []).slice().sort((a, b) => Number(notComing(b)) - Number(notComing(a)))
        .map(player => ({ id: player.id, name: player.name, tone: notComing(player) ? 'danger' : 'accent' }));
    const answers = counts.called ? [copy('expected', { count: counts.expected }), counts.out ? copy('notComing', { count: counts.out }) : ''].filter(Boolean).join(' · ')
        : copy('noCallUps');

    // On a squad's card: when and against whom, then the faces ringed by their answer and the answers in words.
    if (compact) return <Link className="ch-card__line ch-nextmatch" to={data.link('matches', { squad: String(card.squadId) })}>
        <ActivityBadge kind={/friendly/i.test(m.title) ? 'FRIENDLY' : 'MATCH'} size={26} />
        <span className="ch-nextmatch__text">
            <span className="ch-card__line-text"><strong>{when}</strong> · {copy('versus', { team: opponent })}</span>
            <span className="ch-nextmatch__who">{faces.length > 0 && <FaceStack people={faces} max={6} size={20} label={answers} />}
                <span>{answers}</span></span>
        </span>
    </Link>;

    const prep = card.preparation, referee = refereeState(m), ground = groundState(m), can = card.can;
    const steps: { key: string; label: string; state: 'done' | 'now' | 'todo' }[] = [
        { key: 'callups', label: counts.called ? copy('stepCallUps') : copy('stepNoCallUps'), state: counts.called ? 'done' : 'now' },
        { key: 'referee', label: referee.tone === 'neutral' ? copy('stepNoReferee') : referee.tone === 'accent' || prep?.referees ? copy('stepRefereeDone') : copy('stepReferee'), state: referee.tone === 'accent' || referee.tone === 'neutral' || prep?.referees ? 'done' : 'todo' },
        { key: 'pitch', label: ground.tone === 'accent' || prep?.pitch ? copy('stepPitchDone') : copy('stepPitch'), state: ground.tone === 'accent' || prep?.pitch ? 'done' : 'todo' },
        { key: 'firstaid', label: prep?.medical ? copy('stepFirstAidDone', { name: prep.medical }) : copy('stepFirstAid'), state: prep?.medical ? 'done' : 'todo' },
    ];
    const fit = card.fitness;
    const day = [
        card.trip?.departsAt ? { at: card.trip.departsAt, what: [copy('meet'), card.trip.meetingPoint].filter(Boolean).join(' · ') } : null,
        { at: m.starts_at_iso, what: [copy('kickOff'), m.location_name].filter(Boolean).join(' · ') },
        { at: m.ends_at_iso, what: copy('ends') },
    ].filter((row): row is { at: string; what: string } => Boolean(row));
    return <section className="ch-match" aria-label={`${copy('nextMatch')}: ${card.squadName} ${copy('versus', { team: opponent })}`}>
        <div className="ch-match__top">
            <span className="ch-match__sides">
                <Crest src={data.clubLogo} name={data.clubName} size={26} /><strong>{card.squadName}</strong>
                <span className="ch-quiet">{copy('v')}</span>
                <Crest src={ours ? null : m.club_logo_url} name={opponent} size={26} /><strong>{opponent}</strong>
            </span>
            <span className="ch-match__when">{when}</span>
            <span className="ch-match__actions">
                {can?.callUps && <ButtonLink size="sm" variant={counts.called ? 'secondary' : 'primary'} to={page}><Send aria-hidden="true" />{copy(counts.called ? 'callUps' : 'sendCallUps')}</ButtonLink>}
                {can?.checklist && <Button size="sm" onClick={() => setChecking(true)}><ClipboardCheck aria-hidden="true" />{copy('checklist')}</Button>}
                {can?.bus && <ButtonLink size="sm" to={officeToolPath(data.clubId, 'travel', card.trip ? { record: String(card.trip.recordId) } : { squad: String(card.squadId), event: String(m.event_id) })}>
                    <Bus aria-hidden="true" />{card.trip ? copy('trip') : copy('bookBus')}</ButtonLink>}
                {!can?.callUps && <ButtonLink size="sm" variant="ghost" to={page}>{copy('openMatch')}</ButtonLink>}
            </span>
        </div>
        <ul className="ch-match__steps" aria-label={copy('checklist')}>
            {steps.map(step => <li key={step.key} data-state={step.state}>{step.label}</li>)}
        </ul>
        <div className="ch-match__grid">
            <div className="ch-match__part">
                <small>{copy('whoComing')}</small>
                {faces.length > 0 && <FaceStack people={faces} max={12} size={26} label={answers} />}
                <span className="ch-quiet">{answers}</span>
                {fit && <span className="ch-match__fit">
                    {fit.fit > 0 && <span><span className="cw-dot cw-dot--accent" aria-hidden="true" />{copy('fit', { count: fit.fit })}</span>}
                    {fit.doubtful > 0 && <span><span className="cw-dot cw-dot--warning" aria-hidden="true" />{copy('doubtful', { count: fit.doubtful })}</span>}
                    {fit.out > 0 && <span><span className="cw-dot cw-dot--danger" aria-hidden="true" />{copy('out', { count: fit.out })}</span>}
                    {fit.notAssessed > 0 && <span className="ch-quiet">{copy('notAssessed', { count: fit.notAssessed })}</span>}
                </span>}
            </div>
            <div className="ch-match__part">
                <small>{copy('theDay')}</small>
                <ul className="ch-match__day">{day.map(row => <li key={`${row.at}-${row.what}`}><strong className="gk-num">{timeLabel(row.at)}</strong><span>{row.what}</span></li>)}</ul>
            </div>
        </div>
        {(prep?.bring.length ?? 0) > 0 && <div className="ch-match__part">
            <small>{copy('bring')}</small>
            <ul className="ch-match__bring">{prep!.bring.map(item => <li key={item}>{item}</li>)}</ul>
        </div>}
        {checking && <MatchChecklistDialog card={card} data={data} opponent={opponent} onClose={() => setChecking(false)} onSaved={() => { setChecking(false); onChanged(); }} />}
    </section>;
}
