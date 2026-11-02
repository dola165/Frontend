import { useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Briefcase, Shield } from 'lucide-react';
import { Avatar, Button, ButtonLink, Chip } from '../../../../design/primitives';
import { buildLoginPath } from '../../../../utils/authRedirect';
import { ageFromDob } from '../../../../utils/age';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { ActionButton } from '../../../actions/ActionButton';
import { useClubEntryEligibility, useEntryCopy } from '../../../applications/clubEntry';
import { useJourneyCopy } from '../../../squadCommunication/journeyCopy';
import { createClubApplication, selfRegisterClubPlayer } from '../../api';
import { squadLine, trainingDaysLine, type ClubEnquiryContext, type PublicSquad } from '../../publicJourney';
import type { ClubProfile } from '../types';
import { squadFits } from './joinFit';
import type { JoinFacts } from './useJoinFacts';

const POSITIONS: [string, string, string][] = [['GOALKEEPER', 'Goalkeeper', 'მეკარე'], ['DEFENDER', 'Defender', 'მცველი'], ['MIDFIELDER', 'Midfielder', 'ნახევარმცველი'], ['FORWARD', 'Forward', 'თავდამსხმელი'], ['', 'Not sure', 'არ ვიცი']];

/** The way back here after signing in: this club page with the pop-up open at the same part. */
function SignIn({ label }: { label: string }) {
    const here = useLocation();
    return <ButtonLink variant="primary" to={buildLoginPath(`${here.pathname}${here.search}`)}>{label}</ButtonLink>;
}

/** What happened after a press: sent (green) or why not (red), read out either way. */
function Result({ result }: { result: { text: string; error: boolean } | null }) {
    return result && <p className={result.error ? 'gk-join__error' : 'gk-join__done'} role={result.error ? 'alert' : 'status'}>{result.text}</p>;
}

/** A plain note in place of a list: the one line, then at most one way on. */
function Note({ title, children }: { title: string; children?: ReactNode }) {
    return <div className="gk-join__note"><p>{title}</p>{children}</div>;
}

/** Squads to choose one from: name, age group and who plays, when they train, and the faces of their coaches. */
function SquadChoice({ legend, squads, facts, value, onChange }: { legend: string; squads: PublicSquad[]; facts: JoinFacts; value: number | null; onChange: (id: number) => void }) {
    const name = `join-squad-${legend}`;
    return (
        <fieldset className="gk-join__list">
            <legend className="gk-join__legend">{legend} · {squads.length}</legend>
            {squads.map(squad => {
                const coaches = facts.coaches.filter(person => person.responsibilities.some(item => (item.squadIds ?? (item.squadId == null ? [] : [item.squadId])).includes(squad.id)));
                return (
                    <label key={squad.id} className="gk-join__row" data-chosen={value === squad.id || undefined}>
                        <input type="radio" name={name} checked={value === squad.id} onChange={() => onChange(squad.id)} />
                        <span className="gk-join__text"><b>{squad.name}</b><small>{[squadLine(squad), trainingDaysLine(squad.trainingDays, squad.trainingTime)].filter(Boolean).join(' · ')}</small></span>
                        {coaches.length > 0 && <span className="gk-join__faces">{coaches.slice(0, 3).map(person => <Avatar key={person.userId} src={person.avatarUrl} name={person.fullName} size={24} />)}</span>}
                    </label>
                );
            })}
        </fieldset>
    );
}

/** The question goes to the club through its enquiry, about one squad when one is chosen. */
const askClub = (club: ClubProfile, squad?: PublicSquad): ClubEnquiryContext =>
    ({ name: squad?.name ?? club.name, path: `/clubs/${club.id}?tab=teams${squad ? `&squad=${squad.id}` : ''}`, squadIds: squad ? [squad.id] : [], intent: 'question' });

/**
 * Play: the squads that suit the person's age (youth squads never for an adult), where they play, then the club's own
 * rule decides the button: a trial ("Come to a trial") or a request the club answers ("Ask to join"). The server's entry
 * check says first whether the person may (a pending request, an invitation waiting, a club they already play for).
 */
export function PlayPart({ club, facts, onContact, onChanged }: { club: ClubProfile; facts: JoinFacts; onContact: (context: ClubEnquiryContext) => void; onChanged: () => void }) {
    const c = useJourneyCopy();
    const { reason } = useEntryCopy();
    const policy = club.playerJoinPolicy ?? 'INVITE_ONLY';
    const trial = policy === 'OPEN_TRIAL';
    const entry = useClubEntryEligibility(club.id, 'PLAYER', trial ? 'OPEN_TRIAL' : 'JOIN', facts.signedIn && policy !== 'INVITE_ONLY');
    const [squad, setSquad] = useState<number | null>(facts.mySquads.length === 1 ? facts.mySquads[0].id : null);
    const [position, setPosition] = useState('');
    const [busy, setBusy] = useState(false), [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
    if (policy === 'INVITE_ONLY') return <Note title={c('This club takes players by invitation.', 'კლუბი მოთამაშეებს მოწვევით იღებს.')}><Button onClick={() => onContact(askClub(club))}>{c('Ask the club', 'კლუბს მიწერე')}</Button></Note>;
    if (!facts.mySquads.length) return <Note title={c('No squad for your age here.', 'აქ შენი ასაკის გუნდი არ არის.')}>
        {!facts.minor && <p className="gk-join__hint">{c('Jobs, volunteering and coaching are under Help out.', 'სამუშაო, მოხალისეობა და მწვრთნელობა „დახმარებაშია“.')}</p>}
    </Note>;
    const chosen = facts.mySquads.find(item => item.id === squad);
    const send = async () => {
        if (busy || !entry.allowed) return;
        setBusy(true); setResult(null);
        try {
            if (trial) await selfRegisterClubPlayer(club.id, { _authSessionId: entry.sessionId });
            else await createClubApplication(club.id, 'PLAYER', null, { position: position || null, ageGroup: chosen?.category ?? null, squadId: chosen?.id ?? null }, { _authSessionId: entry.sessionId });
            setResult({ text: trial ? c('You can come to training as a trialist.', 'ვარჯიშზე შეგიძლია მოხვიდე, როგორც გასასინჯი მოთამაშე.') : c(`Request sent to ${club.name}.`, `მოთხოვნა გაიგზავნა: ${club.name}.`), error: false });
            onChanged();
        } catch (error) {
            setResult({ text: extractApiErrorMessage(error, c('The request could not be sent. Try again.', 'მოთხოვნა ვერ გაიგზავნა. სცადე თავიდან.')), error: true });
            entry.reload();
        } finally { setBusy(false); }
    };
    const blocked = entry.data && !entry.data.allowed ? reason(entry.data) : null;
    return <>
        <SquadChoice legend={c('Squads for your age', 'გუნდები შენი ასაკისთვის')} squads={facts.mySquads} facts={facts} value={squad} onChange={setSquad} />
        {!trial && <div className="gk-join__positions" role="group" aria-label={c('Where you play', 'სად თამაშობ')}>
            <span className="gk-join__legend">{c('Where you play', 'სად თამაშობ')}</span>
            <div className="gk-join__chips">{POSITIONS.map(([code, en, ka]) => <Chip key={code || 'any'} pressed={position === code} onClick={() => setPosition(code)}>{c(en, ka)}</Chip>)}</div>
        </div>}
        <Result result={result} />
        {blocked && !result && <p className="gk-join__hint" role="status">{blocked}</p>}
        <div className="gk-join__foot">
            {!facts.signedIn ? <SignIn label={c('Sign in to join', 'შედი გასაწევრიანებლად')} />
                : <Button variant="primary" disabled={busy || !entry.allowed || (!trial && !chosen) || Boolean(result && !result.error)} onClick={send}>
                    {busy ? c('Sending…', 'იგზავნება…') : trial ? c('Come to a trial', 'მოდი გასინჯვაზე') : c('Ask to join', 'გაწევრიანების თხოვნა')}
                </Button>}
        </div>
    </>;
}

/**
 * My child: the person's children as faces to choose from (none yet: add one first), the squads that suit the chosen
 * child, then the club's enquiry about a place, with the squad and the child filled in.
 */
export function ChildPart({ club, facts, onContact }: { club: ClubProfile; facts: JoinFacts; onContact: (context: ClubEnquiryContext, playerId?: number) => void }) {
    const c = useJourneyCopy();
    const [params] = useSearchParams();
    const asked = facts.children.find(child => String(child.id) === params.get('player'));
    const [childId, setChildId] = useState<number | null>(asked?.id ?? facts.children[0]?.id ?? null);
    const [squad, setSquad] = useState<number | null>(null);
    if (!facts.signedIn) return <Note title={c('Sign in to ask about a place for your child.', 'შედი, რომ შვილისთვის ადგილზე იკითხო.')}><SignIn label={c('Sign in', 'შესვლა')} /></Note>;
    if (!facts.children.length) return <Note title={c('Add your child first, then ask about a place.', 'ჯერ დაამატე შვილი, შემდეგ იკითხე ადგილზე.')}><ActionButton action="add_child" variant="primary" /></Note>;
    const child = facts.children.find(item => item.id === childId) ?? facts.children[0];
    const first = child.name.trim().split(/\s+/)[0] || child.name;
    const fits = facts.squads.filter(item => squadFits(item, { age: ageFromDob(child.dateOfBirth), gender: child.gender ?? null }));
    const chosen = fits.length === 1 ? fits[0].id : squad;
    const choose = (id: number) => { setChildId(id); setSquad(null); };
    // The enquiry reads the child from the address, as everywhere on the club page: the page puts it there.
    const ask = () => onContact(askClub(club, fits.find(item => item.id === chosen)), child.id);
    return <>
        {facts.children.length > 1 && <div className="gk-join__chips" role="group" aria-label={c('Which child', 'რომელი შვილი')}>
            {facts.children.map(item => <Chip key={item.id} pressed={item.id === child.id} onClick={() => choose(item.id)}>{item.name.trim().split(/\s+/)[0]}</Chip>)}
        </div>}
        {fits.length ? <SquadChoice legend={c(`Squads for ${first}`, `გუნდები: ${first}`)} squads={fits} facts={facts} value={chosen} onChange={setSquad} />
            : <Note title={c(`No squad for ${first}'s age here.`, `აქ ${first}-ის ასაკის გუნდი არ არის.`)} />}
        <div className="gk-join__foot">
            <Button variant="primary" onClick={ask}>{fits.length ? c(`Ask about a place for ${first}`, `იკითხე ადგილზე: ${first}`) : c('Ask the club', 'კლუბს მიწერე')}</Button>
        </div>
    </>;
}

/**
 * Help out: the club's open jobs and volunteering, each opening its page where the application is (the club takes staff
 * only for a posted job or by an admin's invitation), then the squads with no coach on the club page, to ask the club
 * about. No jobs: one way to ask the club.
 */
export function HelpPart({ club, facts, onContact }: { club: ClubProfile; facts: JoinFacts; onContact: (context: ClubEnquiryContext) => void }) {
    const c = useJourneyCopy();
    const ask = (squad?: PublicSquad) => onContact(askClub(club, squad));
    return <>
        {facts.jobs.length > 0 && <div className="gk-join__list">
            <span className="gk-join__legend">{c('Jobs & volunteering', 'სამუშაო და მოხალისეობა')} · {facts.jobs.length}</span>
            {facts.jobs.map(job => <div key={job.id} className="gk-join__row">
                <span className="gk-join__icon gk-join__icon--job"><Briefcase aria-hidden="true" /></span>
                <span className="gk-join__text"><b>{job.title}</b><small>{[job.ageGroup !== 'ANY' && job.ageGroup, job.level && job.level !== 'ANY' && job.level.charAt(0) + job.level.slice(1).toLowerCase()].filter(Boolean).join(' · ')}</small></span>
                <ButtonLink size="sm" to={`/jobs/${job.id}`}>{c('Apply', 'განაცხადი')}</ButtonLink>
            </div>)}
        </div>}
        {facts.uncoached.length > 0 && <div className="gk-join__list">
            <span className="gk-join__legend">{c('No coach on the club page', 'კლუბის გვერდზე მწვრთნელი არ ჩანს')} · {facts.uncoached.length}</span>
            {facts.uncoached.map(squad => <div key={squad.id} className="gk-join__row">
                <span className="gk-join__icon"><Shield aria-hidden="true" /></span>
                <span className="gk-join__text"><b>{squad.name}</b><small>{squadLine(squad)}</small></span>
                <Button size="sm" onClick={() => ask(squad)}>{c('Ask the club', 'კლუბს მიწერე')}</Button>
            </div>)}
        </div>}
        {!facts.jobs.length && !facts.uncoached.length && <Note title={c('No open jobs here right now.', 'ახლა აქ ღია ვაკანსია არ არის.')}>
            <p className="gk-join__hint">{c('Ask the club how you could help.', 'ჰკითხე კლუბს, როგორ შეგიძლია დაეხმარო.')}</p>
            <Button size="sm" onClick={() => ask()}>{c('Ask the club', 'კლუბს მიწერე')}</Button>
        </Note>}
    </>;
}
