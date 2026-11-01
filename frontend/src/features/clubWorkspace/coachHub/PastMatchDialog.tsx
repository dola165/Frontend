import { useRef, useState } from 'react';
import { Avatar, Button, Field } from '../../../design/primitives';
import { ChoiceChips } from '../../../design/ChoiceChips';
import { Combobox } from '../../../design/Combobox';
import { Dialog } from '../../../design/Dialog';
import { useSearch } from '../../../design/useSearch';
import { useAuth } from '../../../context/AuthContext';
import { appLanguage } from '../../../utils/formatting';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { searchClubs } from '../../matchExchange/arrange/api';
import { addMinutes } from '../../matchExchange/arrange/matchPlan';
import { importHistoricalMatch, type HistoricalMatchCreated } from '../../matchHistory/api';
import { ScoreInputs } from '../../scores/ScoreInputs';
import '../../matchExchange/arrange/arrange.css';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

type Opponent = { id: number; name: string; logoUrl?: string | null } | { outside: string };

/**
 * "Add a past match": a match one of our squads played that GrassKickZ does not have, against a club in the app or one
 * named by hand. It goes into the squad's results with our score, which a club in the app can confirm or dispute for 48
 * hours. Only the squads whose matches this person arranges are offered.
 */
export function PastMatchDialog({ clubId, squads, onClose, onSaved }: {
    clubId: number; squads: { id: number; name: string }[]; onClose: () => void; onSaved: (created: HistoricalMatchCreated, opponent: string, inApp: boolean) => void;
}) {
    const copy = useJourneyCopy();
    const { sessionId } = useAuth();
    const [squadId, setSquadId] = useState(squads[0]?.id ?? 0);
    const [query, setQuery] = useState('');
    const [opponent, setOpponent] = useState<Opponent | null>(null);
    const [day, setDay] = useState(''), [time, setTime] = useState('');
    const [goals, setGoals] = useState({ home: '', away: '' });
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    // One request id per filled-in match, so pressing again after a lost answer never adds it twice.
    const request = useRef<{ key: string; id: string } | null>(null);
    const results = useSearch(query, (q, signal) => searchClubs(q, signal));
    const clubs = results.items.filter(club => club.id !== clubId);
    const today = new Date().toISOString().slice(0, 10);
    const name = opponent ? ('outside' in opponent ? opponent.outside.trim() : opponent.name) : '';
    const scored = [goals.home, goals.away].every(value => value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100);
    const ready = Boolean(squadId && name && day && time && scored);
    const squadName = squads.find(squad => squad.id === squadId)?.name ?? '';

    async function save() {
        if (!ready || busy) return;
        // A match lasts an hour and a half here; the record needs an end that has passed.
        const startsAt = `${day}T${time}`, endsAt = addMinutes(startsAt, 90);
        if (new Date(endsAt).getTime() > Date.now()) { setError(copy('Choose a match that has already been played.', 'აირჩიეთ უკვე ჩატარებული მატჩი.')); return; }
        const body = { clubId, opponentClubId: opponent && 'id' in opponent ? opponent.id : null, outsideOpponent: opponent && 'outside' in opponent ? name : null, homeSquadId: squadId,
            startsAt: `${startsAt}:00`, endsAt: `${endsAt}:00`, homeScore: Number(goals.home), awayScore: Number(goals.away), visibility: 'PRIVATE' as const };
        const key = JSON.stringify(body);
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        setBusy(true); setError('');
        try {
            const created = await importHistoricalMatch({ ...body, requestId: request.current.id }, new AbortController().signal, sessionId);
            onSaved(created, name, body.opponentClubId != null);
        } catch (cause) {
            setError(extractApiErrorMessage(cause, copy('The match could not be added. Try again.', 'მატჩი ვერ დაემატა. სცადეთ თავიდან.')));
        } finally { setBusy(false); }
    }

    return <Dialog open size="md" title={copy('Add a past match', 'წარსული მატჩის დამატება')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button onClick={onClose} disabled={busy}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={!ready || busy} onClick={() => void save()}>{busy ? copy('Adding…', 'ემატება…') : copy('Add the match', 'მატჩის დამატება')}</Button></>}>
        <div className="gk-stack">
            {squads.length > 1 && <div className="gk-field"><span className="gk-field__label" id="past-squad">{copy('Our squad', 'ჩვენი გუნდი')}</span>
                <ChoiceChips labelledBy="past-squad" value={squadId} onChange={setSquadId} choices={squads.map(squad => ({ value: squad.id, label: squad.name }))} /></div>}
            {opponent && 'id' in opponent
                ? <div className="gk-field"><span className="gk-field__label">{copy('Opponent', 'მეტოქე')}</span>
                    <div className="gk-arrange__picked"><Avatar src={opponent.logoUrl} name={opponent.name} size={32} square /><span className="gk-arrange__option-text"><strong>{opponent.name}</strong></span>
                        <Button size="sm" variant="ghost" onClick={() => setOpponent(null)}>{copy('Change', 'შეცვლა')}</Button></div></div>
                : opponent ? <Field label={copy('Opponent', 'მეტოქე')} htmlFor="past-outside" hint={copy('Not in GrassKickZ', 'GrassKickZ-ში არ არის')}>
                    <div className="gk-arrange__outside"><input id="past-outside" className="gk-input" maxLength={160} value={opponent.outside} placeholder={copy('Club name', 'კლუბის სახელი')} onChange={event => setOpponent({ outside: event.target.value })} />
                        <Button size="sm" variant="ghost" onClick={() => setOpponent(null)}>{copy('Search GrassKickZ', 'GrassKickZ-ში ძიება')}</Button></div>
                </Field>
                    : <Field label={copy('Opponent', 'მეტოქე')} htmlFor="past-opponent">
                        <Combobox id="past-opponent" label={copy('Clubs', 'კლუბები')} query={query} onQuery={setQuery} items={clubs} itemKey={club => club.id} status={results.status}
                            placeholder={copy('Search clubs', 'კლუბების ძიება')} loadingText={copy('Searching…', 'იძებნება…')} emptyText={copy('No club with that name', 'ასეთი კლუბი არ მოიძებნა')} errorText={copy('Club search is unavailable.', 'კლუბების ძიება მიუწვდომელია.')}
                            renderItem={club => <><Avatar src={club.logoUrl} name={club.name} size={28} square /><span className="gk-arrange__option-text"><strong>{club.name}</strong></span></>}
                            onSelect={club => { setOpponent({ id: club.id, name: club.name, logoUrl: club.logoUrl }); setQuery(''); }} />
                        <Button size="sm" variant="ghost" className="gk-arrange__not-here" onClick={() => setOpponent({ outside: query.trim() })}>{copy('Not in GrassKickZ? Type its name', 'GrassKickZ-ში არ არის? ჩაწერეთ სახელი')}</Button>
                    </Field>}
            <div className="gk-arrange__kickoff">
                <Field label={copy('Played on', 'თამაშის დღე')} htmlFor="past-day"><input id="past-day" className="gk-input" type="date" lang={appLanguage()} max={today} value={day} onChange={event => setDay(event.target.value)} /></Field>
                <Field label={copy('Kick-off', 'დასაწყისი')} htmlFor="past-time"><input id="past-time" className="gk-input" type="time" lang={appLanguage()} step={300} value={time} onChange={event => setTime(event.target.value)} /></Field>
            </div>
            <ScoreInputs home={{ name: squadName || copy('Our squad', 'ჩვენი გუნდი') }} away={{ name: name || copy('Opponent', 'მეტოქე') }} value={goals} disabled={busy} onChange={setGoals} />
            <p className="gk-faint">{opponent && 'id' in opponent ? copy(`Our score stands; ${opponent.name} can confirm or dispute it for 48 hours.`, `ჩვენი ანგარიში ძალაშია; ${opponent.name}-ს 48 საათის განმავლობაში შეუძლია დადასტურება ან გასაჩივრება.`)
                : copy('Our score stands; we can correct it for 48 hours.', 'ჩვენი ანგარიში ძალაშია; 48 საათის განმავლობაში შეგვიძლია შესწორება.')}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
