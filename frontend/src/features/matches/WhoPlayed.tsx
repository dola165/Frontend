import { useRef, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Button, EmptyNote, Section } from '../../design/primitives';
import { FaceStack } from '../../design/visuals';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { post, type Match } from '../matchExchange/api';
import { useAction, useClock, useLoad } from '../matchExchange/hooks';
import './match-page.css';

export type WhoPlayedTeam = {
    squadId: number; squadName: string; canChange: boolean;
    players: { id: number; name: string; played: boolean; added: boolean }[];
    /** The squad's other players, for "Add a player" (only to those who may change the list). */
    others: { id: number; name: string }[];
};
/** Who can confirm a player added afterwards; NOBODY while nobody else is in the app (it waits, and says why). */
export type WhoPlayedConfirmer = 'OTHER_CLUB' | 'REFEREE' | 'ORGANISER' | 'NOBODY';
/** `playerName` is the full name for the player's own club; anyone else reads the first name, last initial and shirt. */
export type WhoPlayedAddition = { id: number; squadId: number; squadName: string; clubName: string; playerName: string; shirt?: number | null;
    status: 'PENDING' | 'DECLINED'; canDecide: boolean; confirmer?: WhoPlayedConfirmer };
/** `revision` moves on with every change; a change names the one it was made on. */
export type WhoPlayedList = { lockedAt: string | null; changeUntil: string | null; revision?: number; teams: WhoPlayedTeam[]; additions: WhoPlayedAddition[] };

/**
 * One request id per change the person means (fix round 1): a retry after a lost reply sends the same one, so it is
 * the change already made and never undoes someone else's correction made since. The list's revision is in the key,
 * so the next change on a fresh list is a new request.
 */
function useRequestIds() {
    const ids = useRef(new Map<string, string>());
    return (key: string) => {
        let id = ids.current.get(key);
        if (!id) { id = crypto.randomUUID(); ids.current.set(key, id); }
        return id;
    };
}

/**
 * Who played (owner, 29 October 2026): nobody ticks anything. At kick-off the called-up players who didn't say they
 * can't come are saved as who played, and the list is locked. For 48 hours a squad's match staff take off a no-show
 * (and put them back); adding a player who wasn't called up waits for an independent yes (the other club's, the
 * referee's or a competition's organiser's), as a score does, and with nobody to ask it waits and says why. Families
 * see only their own child, as with call-ups.
 */
export function WhoPlayed({ match: m }: { match: Match }) {
    const copy = useJourneyCopy();
    const { data, error, reload } = useLoad<WhoPlayedList>(`/match-arrangements/${m.event_id}/who-played`);
    const { run, busy, feedback } = useAction(reload);
    const now = useClock();
    if (error) return <p className="gk-notice gk-notice--danger" role="alert">{copy('Who played could not load.', 'ვინ ითამაშა, ვერ ჩაიტვირთა.')}</p>;
    // Nothing to show until the lists arrive (or for an answer without them).
    if (!Array.isArray(data?.teams)) return null;
    const open = Boolean(data.changeUntil && Date.parse(data.changeUntil) > now);
    const additions = data.additions ?? [];
    const decide = additions.filter(a => a.canDecide && a.status === 'PENDING');
    // A notice about an added player opens the page at its list (#who-played).
    return <>
        {data.teams.map((team, index) => <TeamPlayed key={team.squadId} match={m} team={team} open={open} saved={Boolean(data.lockedAt)}
            revision={data.revision ?? 0} anchor={index === 0 && !decide.length}
            waiting={additions.filter(a => a.squadId === team.squadId && !a.canDecide)} reload={reload} />)}
        {decide.length > 0 && <Section boxed icon={UserCheck} id="who-played" title={copy('Players to confirm', 'დასადასტურებელი მოთამაშეები')} hint={`${decide.length}`}>
            <ul className="gk-callups gk-callups--decide" aria-label={copy('Players to confirm', 'დასადასტურებელი მოთამაშეები')}>{decide.map(addition => <li key={addition.id}>
                <span className="gk-callups__who"><span className="gk-callups__name">{addition.playerName}{addition.shirt != null && <span className="gk-faint"> · #{addition.shirt}</span>}</span>
                    <span className="gk-callups__state">{copy(`Added by ${addition.clubName}`, `დაამატა: ${addition.clubName}`)}</span></span>
                <span className="gk-match-actions">
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/who-played/additions/${addition.id}`, { action: 'CONFIRM' }), copy('Confirmed', 'დადასტურებულია'))}>{copy('Confirm', 'დადასტურება')}</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/who-played/additions/${addition.id}`, { action: 'DECLINE' }), copy('Declined', 'უარყოფილია'))}>{copy('Decline', 'უარყოფა')}</Button>
                </span>
            </li>)}</ul>
            <div className="gk-mx gk-match-feedback">{feedback}</div>
        </Section>}
    </>;
}

function TeamPlayed({ match: m, team, open, saved, revision, anchor, waiting, reload }: {
    match: Match; team: WhoPlayedTeam; open: boolean; saved: boolean; revision: number; anchor: boolean; waiting: WhoPlayedAddition[]; reload: () => void;
}) {
    const copy = useJourneyCopy();
    const { run, busy, feedback } = useAction(reload);
    const requestId = useRequestIds();
    const [adding, setAdding] = useState('');
    const played = team.players.filter(p => p.played);
    const change = team.canChange && open;
    const title = team.canChange ? copy(`${team.squadName} · who played`, `${team.squadName} · ვინ ითამაშა`) : copy('Who played', 'ვინ ითამაშა');
    const hint = [copy(`${played.length} played`, `${played.length} ითამაშა`), saved ? copy('saved at kick-off', 'შენახულია დაწყებისას') : null].filter(Boolean).join(' · ');
    // On the list this person sees (its revision); a retry of the same change sends the same request id.
    const set = (player: { id: number }, value: boolean) => void run(() => post(`/match-arrangements/${m.event_id}/squads/${team.squadId}/who-played`,
        { playerId: player.id, played: value, revision, requestId: requestId(`set:${player.id}:${value}:${revision}`) }),
        value ? copy('Back on the list', 'სიაში დაბრუნდა') : copy('Taken off: didn’t play', 'ამოღებულია: არ უთამაშია'));
    const pending = (addition: WhoPlayedAddition) => {
        switch (addition.confirmer) {
            case 'REFEREE': return copy(`${addition.playerName}: waiting for the referee to confirm`, `${addition.playerName}: ელოდება მსაჯის დადასტურებას`);
            case 'ORGANISER': return copy(`${addition.playerName}: waiting for the organiser to confirm`, `${addition.playerName}: ელოდება ორგანიზატორის დადასტურებას`);
            case 'NOBODY': return copy(`${addition.playerName}: waiting. Nobody can confirm it yet: the other club isn’t in GrassKickZ and no referee accepted.`,
                `${addition.playerName}: ელოდება. ჯერ ვერავინ დაადასტურებს: მეორე კლუბი GrassKickZ-ში არ არის და მსაჯს არ დაუდასტურებია.`);
            default: return copy(`${addition.playerName}: waiting for the other club to confirm`, `${addition.playerName}: ელოდება მეორე კლუბის დადასტურებას`);
        }
    };
    return <Section boxed icon={UserCheck} id={anchor ? 'who-played' : undefined} title={title} hint={hint}>
        {!team.players.length ? <EmptyNote title={copy('Nobody was called up, so nobody is listed', 'არავინ იყო გამოძახებული, ამიტომ სიაც ცარიელია')} /> : <>
            {played.length > 0 && <FaceStack people={played.map(p => ({ id: p.id, name: p.name, tone: 'accent' as const }))} max={12} size={30} label={hint} />}
            <ul className="gk-callups" aria-label={title}>{team.players.map(player => <li key={player.id} data-out={!player.played || undefined}>
                <span className="gk-callups__name">{player.name}</span>
                <span className="gk-callups__state">{player.played ? (player.added ? copy('Added', 'დამატებული') : copy('Played', 'ითამაშა')) : copy('Didn’t play', 'არ უთამაშია')}</span>
                {change && !player.added && <Button size="sm" variant="ghost" disabled={busy} onClick={() => set(player, !player.played)}>
                    {player.played ? copy('Didn’t play', 'არ უთამაშია') : copy('Undo', 'გაუქმება')}</Button>}
            </li>)}</ul>
        </>}
        {waiting.map(addition => <p key={addition.id} className="gk-faint">{addition.status === 'PENDING' ? pending(addition)
            : copy(`${addition.playerName}: not confirmed`, `${addition.playerName}: არ დადასტურდა`)}</p>)}
        {change && team.others.length > 0 && <div className="gk-match-name">
            <select className="gk-input" aria-label={copy('Add a player who wasn’t called up', 'გამოუძახებელი მოთამაშის დამატება')} value={adding} onChange={event => setAdding(event.target.value)}>
                <option value="">{copy('Add a player who wasn’t called up…', 'გამოუძახებელი მოთამაშის დამატება…')}</option>
                {team.others.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
            <Button size="sm" disabled={busy || !adding} onClick={() => void run(async () => {
                await post(`/match-arrangements/${m.event_id}/squads/${team.squadId}/who-played/additions`, { playerId: Number(adding), requestId: requestId(`add:${adding}:${revision}`) });
                setAdding('');
            }, copy('Added; it waits for an independent yes', 'დაემატა; ელოდება დამოუკიდებელ დადასტურებას'))}>{copy('Add', 'დამატება')}</Button>
        </div>}
        {change && <p className="gk-faint">{copy('You can change this list for 48 hours after kick-off.', 'ამ სიის შეცვლა დაწყებიდან 48 საათის განმავლობაში შეგიძლიათ.')}</p>}
        <div className="gk-mx gk-match-feedback">{feedback}</div>
    </Section>;
}
