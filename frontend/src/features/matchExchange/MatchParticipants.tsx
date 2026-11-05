import { useState } from 'react';
import { Users } from 'lucide-react';
import { Button, EmptyNote, Section } from '../../design/primitives';
import { FaceStack } from '../../design/visuals';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useLoad, useAction, useClock } from './hooks';
import { post, type Match } from './api';
import { expectedLine, notComing, type CallUpPlayer, type CallUpTeam } from './callUps';
import './detail/match-detail.css';
import '../matches/match-page.css';

/**
 * The squads' call-ups on the match page: faces ringed by their answer and how many are expected. Match staff choose who
 * is called up and may say "Can't come" for a player; a player or their family says it for themselves. Nobody presses
 * "coming" and nobody is reminded to answer. Families see only their own child.
 */
export function MatchParticipants({ match, reload }: { match: Match; reload: () => void }) {
    const copy = useJourneyCopy();
    const { data, error, reload: refresh } = useLoad<CallUpTeam[]>(`/match-arrangements/${match.event_id}/participants`);
    return <>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{copy('The call-ups could not load.', 'გამოძახებები ვერ ჩაიტვირთა.')}</p>}
        {data?.map(team => <TeamCallUps key={team.squadId} team={team} match={match} reload={() => { refresh(); reload(); }} />)}
    </>;
}

function TeamCallUps({ team, match, reload }: { team: CallUpTeam; match: Match; reload: () => void }) {
    const copy = useJourneyCopy();
    const [editing, setEditing] = useState<{ ids: number[]; revision: number }>();
    const { run, busy, feedback } = useAction(reload);
    const now = useClock();
    const upcoming = match.event_status === 'SCHEDULED' && Date.parse(match.starts_at_iso) > now;
    const called = team.players.filter(p => p.selected);
    const answer = (player: CallUpPlayer, response: 'NOT_GOING' | 'EXPECTED') => void run(() => post(`/match-arrangements/${match.event_id}/squads/${team.squadId}/attendance`,
        { playerId: player.id, response, revision: player.revision, matchRevision: match.revision }), response === 'NOT_GOING' ? copy("Saved: can't come", 'შენახულია: ვერ მოდის') : copy('Saved: expected', 'შენახულია: მოსალოდნელია'));
    const toggle = (id: number, on: boolean) => editing && setEditing({ ...editing, ids: on ? [...editing.ids, id] : editing.ids.filter(value => value !== id) });
    const title = team.canManage ? copy(`${team.squadName} call-ups`, `${team.squadName} · გამოძახებები`) : copy('Your call-up', 'თქვენი გამოძახება');
    return <Section boxed icon={Users} title={title} hint={called.length ? expectedLine(called, copy) : undefined}
        action={team.canManage && upcoming && !editing ? <Button size="sm" onClick={() => setEditing({ ids: called.map(p => p.id), revision: match.revision })}>{copy('Choose who’s called up', 'გამოძახებულების არჩევა')}</Button> : undefined}>
        {editing ? <>
            <ul className="gk-callups gk-callups--choose" aria-label={copy('Players', 'მოთამაშეები')}>{team.players.map(player =>
                <li key={player.id}><label className="gk-match-check">
                    <input type="checkbox" checked={editing.ids.includes(player.id)} disabled={player.waiting && !player.selected} onChange={event => toggle(player.id, event.target.checked)} />
                    <span>{player.name}</span>{player.waiting && <small className="gk-faint">{copy('waiting for a parent', 'მშობლის პასუხს ელოდება')}</small>}
                </label></li>)}</ul>
            <div className="gk-match-actions">
                <Button variant="primary" disabled={busy} onClick={() => void run(async () => { await post(`/match-arrangements/${match.event_id}/squads/${team.squadId}/participants`, { playerIds: editing.ids, revision: editing.revision }); setEditing(undefined); },
                    copy('Call-ups saved; families are told', 'გამოძახებები შენახულია; ოჯახებს ეცნობათ'))}>{copy(`Call up ${editing.ids.length}`, `${editing.ids.length}-ის გამოძახება`)}</Button>
                <Button disabled={busy} onClick={() => setEditing(undefined)}>{copy('Cancel', 'გაუქმება')}</Button>
            </div>
        </> : !called.length ? <EmptyNote title={team.canManage ? copy('Nobody called up yet', 'ჯერ არავინაა გამოძახებული') : copy('No call-up for you or your child', 'თქვენთვის ან თქვენი შვილისთვის გამოძახება არ არის')} />
            : <>
                <FaceStack people={called.map(p => ({ id: p.id, name: p.name, tone: notComing(p) ? 'danger' : 'accent' }))} max={10} size={30} label={expectedLine(called, copy)} />
                <ul className="gk-callups" aria-label={title}>{called.map(player => {
                    const out = notComing(player), mayAnswer = upcoming && (team.canManage || player.canRespond);
                    return <li key={player.id} data-out={out || undefined}>
                        <span className="gk-callups__name">{player.name}</span>
                        <span className="gk-callups__state">{out ? copy('Not coming', 'ვერ მოდის') : copy('Expected', 'მოსალოდნელია')}</span>
                        {mayAnswer && <Button size="sm" variant={out ? 'ghost' : 'secondary'} disabled={busy} onClick={() => answer(player, out ? 'EXPECTED' : 'NOT_GOING')}>
                            {out ? copy('Undo', 'გაუქმება') : copy('Can’t come', 'ვერ მოვა')}</Button>}
                    </li>;
                })}</ul>
            </>}
        <div className="gk-mx gk-match-feedback">{feedback}</div>
    </Section>;
}
