import { useState } from 'react';
import { Button } from '../../../../design/primitives';
import type { Squad } from '../../../matchExchange/api';
import { ageGroupOf } from '../../../matchExchange/arrange/matchPlan';
import { acceptInvitation, declineInvitation, registerPlayer, requestEntry, reviewInvitation, withdrawEntry } from '../../../tournaments/api';
import { instantEntry, type EntryGate } from '../../../tournaments/entryGates';
import { useWorldCopy } from '../../copy';
import { feeLabel, lastEntryDay } from '../../directories/tournaments/tournamentItem';
import { shortDate } from '../../format';
import { zoned } from '../../scoreboard/standings';
import { useNow } from '../../scoreboard/useNow';
import { useWorldData } from '../../useWorldData';
import { SendError } from '../SendError';
import { useSend } from '../useSend';
import { entryWords, type TournamentPaneData } from './tournamentPane';
import '../step.css';

type Copy = ReturnType<typeof useWorldCopy>;
/** Entries carry no request id: a 409 may mean the entry already went through, so the step offers Reload, never Send again. */
const CHANGED = 'This tournament changed since you opened it, or your entry already went through.';

/**
 * What entering does, said before sending: who enters, then the waiting list when it is full, else whether the entry is in
 * at once as the backend decides it (an accepted invitation waits for approval too).
 */
function entering(team: string, data: TournamentPaneData, full: boolean, t: Copy) {
    if (full) return t('Enters {team}. The tournament is full, so {team} joins the waiting list and moves up when a team withdraws.', { team });
    return instantEntry(data.detail, data.rules) ? t('Enters {team}. They are in at once.', { team }) : t('Enters {team}. The organiser approves each entry.', { team });
}

/** The fee in words, when there is one: "150 GEL a team, paid to the organiser". */
function Fee({ data }: { data: TournamentPaneData }) {
    const t = useWorldCopy();
    return data.rules?.entryFee ? <p className="gk-step__warn">{t('Entry fee {fee}, paid to the organiser', { fee: feeLabel(data.rules) ?? '' })}</p> : null;
}

/** Squads as chips: those of the tournament's age first (a hint only, the backend checks ages from the roster), the rest in a list. */
function SquadChoice({ squads, age, value, onChange }: { squads: Squad[]; age?: string; value?: number; onChange: (id: number) => void }) {
    const t = useWorldCopy();
    const fitting = squads.filter(squad => ageGroupOf(squad.category) === age);
    const quick = fitting.length ? fitting : squads, others = squads.filter(squad => !quick.includes(squad));
    if (squads.length < 2) return null;
    return (
        <div className="gk-step__row" role="group" aria-label={t('Your squad')}>
            {quick.map(squad => <button key={squad.id} type="button" className="gk-chip" aria-pressed={squad.id === value} onClick={() => onChange(squad.id)}>{squad.name}</button>)}
            {others.length > 0 && <select className="gk-input gk-step__other" aria-label={t('Another squad')} value={others.some(squad => squad.id === value) ? value : ''} onChange={event => event.target.value && onChange(Number(event.target.value))}>
                <option value="">{t('Another squad…')}</option>
                {others.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
            </select>}
        </div>
    );
}

/** Entering a tournament: the club (when the person arranges for more than one), the squad, the fee, one sentence of what happens, Enter. */
export function EnterStep({ data, gate, reload }: { data: TournamentPaneData; gate: Extract<EntryGate, { kind: 'enter' }>; reload: () => void }) {
    const t = useWorldCopy();
    const { detail, rules } = data;
    const [clubId, setClubId] = useState(gate.clubs[0].id);
    const club = gate.clubs.find(item => item.id === clubId) ?? gate.clubs[0];
    const fitting = club.squads.filter(squad => ageGroupOf(squad.category) === rules?.ageGroup);
    const [picked, setPicked] = useState<number>();
    const squadId = picked ?? (fitting.length === 1 ? fitting[0].id : club.squads.length === 1 ? club.squads[0].id : undefined);
    const squad = club.squads.find(item => item.id === squadId);
    const { busy, error, changed, send } = useSend(reload, CHANGED, true);
    return (
        <section className="gk-step" aria-label={t('Enter the tournament')}>
            <h4 className="gk-step__title">{t('Enter {tournament}', { tournament: detail.name })}</h4>
            {gate.clubs.length > 1 && <div className="gk-step__row" role="group" aria-label={t('Your club')}>
                {gate.clubs.map(item => <button key={item.id} type="button" className="gk-chip" aria-pressed={item.id === club.id} onClick={() => { setClubId(item.id); setPicked(undefined); }}>{item.name}</button>)}
            </div>}
            <SquadChoice squads={club.squads} age={rules?.ageGroup} value={squadId} onChange={setPicked} />
            <Fee data={data} />
            <p className="gk-step__preview">{squad ? entering(squad.name, data, gate.full, t) : t('Choose the squad that would play.')}</p>
            <SendError error={error} changed={changed} reload={reload} />
            <div className="gk-step__actions">
                <Button variant="primary" disabled={!squad || busy} onClick={() => void send(() => requestEntry(detail.id, { clubId: club.id, squadId: squad!.id }),
                    t('Entry sent for {team}.', { team: squad!.name }), t('The entry could not be sent.'))}>
                    {busy ? t('Sending…') : squad ? t('Enter {team}', { team: squad.name }) : t('Enter')}
                </Button>
            </div>
        </section>
    );
}

/**
 * An invitation to enter, answered in the tournament's pane: the squad (the one invited, else one the person may
 * arrange for at the invited club, needed when the tournament takes squads), when entries close, what accepting does,
 * then Accept, or Decline after a second press. A club already in says so: a club enters once.
 */
export function AnswerStep({ data, gate, squads, reload }: { data: TournamentPaneData; gate: Extract<EntryGate, { kind: 'answer' }>; squads: Squad[] | undefined; reload: () => void }) {
    const t = useWorldCopy();
    const { detail } = data, { invitation } = gate;
    const review = useWorldData(`invitation-review:${invitation.invitationId}`, signal => reviewInvitation(detail.id, invitation.invitationId, signal), t('The invitation could not load.'));
    const mine = (squads ?? []).filter(squad => squad.club_id === invitation.clubId);
    // The squad invited; else, when the tournament takes squads, those the backend allows (mine among them when I arrange for some); else mine at that club.
    const allowed = review.data?.squads ?? [];
    const choices: { id: number; name: string }[] = invitation.squadId ? [{ id: invitation.squadId, name: invitation.squadName ?? t('Invited squad') }]
        : review.data?.requiresSquad ? (mine.length ? allowed.filter(squad => mine.some(own => own.id === squad.id)) : allowed) : mine;
    const [picked, setPicked] = useState<number>();
    const squadId = picked ?? (choices.length === 1 ? choices[0].id : undefined);
    const squad = choices.find(item => item.id === squadId);
    // A squad is named whenever one can be: a coach who arranges for squads answers for one of them.
    const needsSquad = Boolean(invitation.squadId || review.data?.requiresSquad || mine.length);
    const team = squad?.name ?? invitation.squadName ?? invitation.clubName ?? t('you');
    const [declining, setDeclining] = useState(false);
    const { busy, error, changed, send } = useSend(reload, CHANGED, true);
    const now = useNow();
    const closes = lastEntryDay(detail.registrationClosesAt);
    // Accepting enters the team, so it takes the entry window like any entry: not before it opens, not after it closes
    // (declining stays possible).
    const opensAt = zoned(detail.registrationOpensAt), early = opensAt != null && Date.parse(opensAt) > now;
    const closesAt = zoned(detail.registrationClosesAt), late = closesAt != null && Date.parse(closesAt) < now;
    const declineOnly = Boolean(gate.entered) || late;
    return (
        <section className="gk-step" aria-label={t('Answer the invitation')}>
            <h4 className="gk-step__title">{t('{tournament} invites {team}', { tournament: detail.name, team: invitation.squadName ?? invitation.clubName ?? t('you') })}</h4>
            {!invitation.squadId && !declineOnly && <SquadChoice squads={choices.map(item => ({ id: item.id, name: item.name, category: mine.find(own => own.id === item.id)?.category ?? '', club_id: invitation.clubId ?? 0, club_name: invitation.clubName ?? '' }))}
                age={data.rules?.ageGroup} value={squadId} onChange={setPicked} />}
            {late ? <p className="gk-step__warn">{t('Entries are closed')}</p>
                : early ? <p className="gk-step__warn">{t('You can accept from {date}, when entries open.', { date: shortDate(opensAt) ?? '' })}</p>
                : closes && <p className="gk-step__warn">{t('Last day to enter {date}', { date: closes })}</p>}
            {!declineOnly && <Fee data={data} />}
            {gate.entered ? <p className="gk-step__warn">{t('{club} is already in this tournament; a club enters once.', { club: invitation.clubName ?? t('Your club') })}</p>
                : late || review.loading ? null
                : needsSquad && !choices.length ? <p className="gk-step__warn">{t('None of the squads you arrange for can accept. Ask your club’s leadership.')}</p>
                : <p className="gk-step__preview">{needsSquad && !squad ? t('Choose the squad that would play.') : entering(team, data, gate.full, t)}</p>}
            {review.error && <p className="gk-step__error" role="alert">{review.error} <button type="button" className="gk-step__reload" onClick={review.retry}>{t('Try again')}</button></p>}
            <SendError error={error} changed={changed} reload={reload} />
            <div className="gk-step__actions">
                {declining || declineOnly ? <>
                    <Button variant="danger" disabled={busy} onClick={() => void send(() => declineInvitation(detail.id, invitation.invitationId), t('Invitation declined. The organiser is told.'), t('The answer could not be sent.'))}>{declineOnly ? t('Decline the invitation') : t('Decline')}</Button>
                    {!declineOnly && <Button variant="ghost" disabled={busy} onClick={() => setDeclining(false)}>{t('Keep it')}</Button>}
                </> : <>
                    <Button variant="primary" disabled={busy || early || review.loading || (needsSquad && !squad)} onClick={() => void send(() => acceptInvitation(detail.id, invitation.invitationId, squad?.id ?? null),
                        t('Invitation accepted for {team}.', { team }), t('The answer could not be sent.'))}>
                        {busy ? t('Sending…') : t('Accept invitation')}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>{t('Decline')}</Button>
                </>}
            </div>
        </section>
    );
}

/** My entry: how it stands, and Withdraw after a second press while the tournament is still being planned. */
export function EnteredStep({ data, gate, reload }: { data: TournamentPaneData; gate: Extract<EntryGate, { kind: 'entered' }>; reload: () => void }) {
    const t = useWorldCopy();
    const { entry } = gate;
    const team = entry.squadName ?? entry.clubName ?? entry.displayName ?? t('Your entry');
    // My own registration in a players' tournament is said as mine.
    const own = entry.userId != null && entry.clubId == null;
    const words = own ? (entry.status === 'PENDING' ? t('You are registered; the organiser approves players.') : entry.status === 'WAITLISTED' ? t('You are on the waiting list') : t('You are in'))
        : entryWords(entry, team, t);
    const [withdrawing, setWithdrawing] = useState(false);
    const { busy, error, changed, send } = useSend(reload, CHANGED, true);
    return (
        <section className="gk-step" data-done="" aria-label={t('Your entry')}>
            <p className="gk-step__done">{words}</p>
            <SendError error={error} changed={changed} reload={reload} />
            {/* The first button stays the same element (focus stays on it): Withdraw, then Keep the entry; the irreversible one
                appears beside it, never under the pointer that pressed Withdraw. */}
            {gate.withdrawable && <div className="gk-step__actions">
                <Button variant="ghost" size={withdrawing ? undefined : 'sm'} disabled={busy} onClick={() => setWithdrawing(value => !value)}>{withdrawing ? t('Keep the entry') : t('Withdraw')}</Button>
                {withdrawing && <Button variant="danger" disabled={busy} onClick={() => void send(() => withdrawEntry(data.detail.id, entry.id), own ? t('You withdrew.') : t('{team} withdrawn.', { team }), t('The entry could not be withdrawn.'))}>{own ? t('Withdraw') : t('Withdraw {team}', { team })}</Button>}
            </div>}
        </section>
    );
}

/** A players' tournament: register yourself (the fee, the waiting list when it is full), one button. */
export function RegisterStep({ data, gate, reload }: { data: TournamentPaneData; gate: Extract<EntryGate, { kind: 'register' }>; reload: () => void }) {
    const t = useWorldCopy();
    const { busy, error, changed, send } = useSend(reload, CHANGED, true);
    return (
        <section className="gk-step" aria-label={t('Register')}>
            <h4 className="gk-step__title">{t('Register for {tournament}', { tournament: data.detail.name })}</h4>
            <Fee data={data} />
            <p className="gk-step__preview">{gate.full ? t('The tournament is full, so you join the waiting list and move up when a player withdraws.') : t('You enter as a player; the organiser puts players into teams.')}</p>
            <SendError error={error} changed={changed} reload={reload} />
            <div className="gk-step__actions">
                <Button variant="primary" disabled={busy} onClick={() => void send(() => registerPlayer(data.detail.id), t('Registration sent.'), t('The registration could not be sent.'))}>
                    {busy ? t('Sending…') : t('Register')}
                </Button>
            </div>
        </section>
    );
}
