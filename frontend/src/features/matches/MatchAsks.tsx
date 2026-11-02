import { useState } from 'react';
import { Button, Field, Panel } from '../../design/primitives';
import { ChoiceChips } from '../../design/ChoiceChips';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { post, type Match, type Squad } from '../matchExchange/api';
import { useAction } from '../matchExchange/hooks';
import { kickoffDay, kickoffTime } from '../matchExchange/detail/matchState';
import { ageGroupOf } from '../matchExchange/arrange/matchPlan';

/**
 * The other club, asked about a calendar match against it (step 6): "Dinamo added a match against you, Sat 31 Oct
 * 11:00". Its match staff add it to one of their squads' weeks (the match becomes two-sided) or say "Not us". The first
 * answer counts; a later one is told who answered.
 */
export function OpponentAnswer({ match: m, squads, reload }: { match: Match; squads: Squad[]; reload: () => void }) {
    const copy = useJourneyCopy();
    const ours = squads.filter(s => s.club_id === m.opponent_asked_club);
    const sameAge = ours.filter(s => ageGroupOf(s.category) === m.age_group);
    const quick = sameAge.length ? sameAge : ours, others = ours.filter(s => !quick.includes(s));
    const [squad, setSquad] = useState<number | null>(quick.length === 1 ? quick[0].id : null);
    const { run, busy, feedback } = useAction(reload);
    const answer = (value: 'ADD' | 'NOT_US') => void run(() => post(`/match-arrangements/${m.event_id}/opponent-answer`, { answer: value, squadId: value === 'ADD' ? squad : null, revision: m.revision }),
        value === 'ADD' ? copy('Added to your squad’s week', 'დაემატა თქვენი გუნდის კვირას') : copy('Done: it’s not your club’s match', 'მზადაა: ეს თქვენი კლუბის მატჩი არ არის'));
    return <Panel className="gk-match-callout" as="section">
        <div className="gk-match-callout__body">
            <h2 className="gk-match-callout__title">{copy(`${m.club_name} added a match against you, ${kickoffDay(m)} ${kickoffTime(m)}`, `${m.club_name}-მა თქვენთან მატჩი დაამატა, ${kickoffDay(m)} ${kickoffTime(m)}`)}</h2>
            {ours.length > 1 && <div className="gk-field"><span className="gk-field__label" id="answer-squad">{copy('Which squad plays?', 'რომელი გუნდი თამაშობს?')}</span>
                <div className="gk-match-squads">
                    <ChoiceChips labelledBy="answer-squad" value={quick.some(s => s.id === squad) ? squad : null} onChange={setSquad} choices={quick.map(s => ({ value: s.id, label: s.name }))} />
                    {others.length > 0 && <select className="gk-input" aria-label={copy('Another squad', 'სხვა გუნდი')} value={others.some(s => s.id === squad) ? squad ?? '' : ''}
                        onChange={event => event.target.value && setSquad(Number(event.target.value))}>
                        <option value="">{copy('Another squad…', 'სხვა გუნდი…')}</option>
                        {others.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>}
                </div></div>}
            <div className="gk-mx">{feedback}</div>
            <div className="gk-match-actions">
                <Button variant="primary" disabled={busy || !squad} onClick={() => answer('ADD')}>{copy('Add it to our week', 'ჩვენს კვირაში დამატება')}</Button>
                <Button disabled={busy} onClick={() => answer('NOT_US')}>{copy('Not us', 'ჩვენ არა')}</Button>
            </div>
        </div>
    </Panel>;
}

/** Staff type the opponent of a match that has none in the app: a session that became a match, a club outside it. */
export function NameOpponent({ match: m, reload }: { match: Match; reload: () => void }) {
    const copy = useJourneyCopy();
    const [name, setName] = useState(m.outside_opponent ?? '');
    const [open, setOpen] = useState(!m.outside_opponent);
    const { run, busy, feedback } = useAction(() => { setOpen(false); reload(); });
    if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{copy('Change the opponent’s name', 'მეტოქის სახელის შეცვლა')}</Button>;
    return <form className="gk-match-name" onSubmit={event => { event.preventDefault(); if (name.trim()) void run(() => post(`/match-arrangements/${m.event_id}/outside-opponent`, { name: name.trim(), revision: m.revision }), copy('Opponent named', 'მეტოქე დასახელებულია')); }}>
        <Field label={copy('Opponent', 'მეტოქე')} htmlFor="match-opponent-name" hint={copy('A club that isn’t in GrassKickZ', 'კლუბი, რომელიც GrassKickZ-ში არ არის')}>
            <input id="match-opponent-name" className="gk-input" maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder={copy('Old Town FC', 'ძველი ქალაქის ფკ')} />
        </Field>
        <Button type="submit" size="sm" variant="primary" disabled={busy || !name.trim()}>{copy('Save', 'შენახვა')}</Button>
        <div className="gk-mx">{feedback}</div>
    </form>;
}
