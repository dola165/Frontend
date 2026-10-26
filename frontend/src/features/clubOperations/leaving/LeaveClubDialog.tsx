import { useEffect, useState } from 'react';
import { Crown, DoorOpen, Lock } from 'lucide-react';
import { Avatar, Button } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { refreshAccess } from '../../../hooks/useCan';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { fetchPeople, type Person } from '../people/api';
import { dissolveClub as closeClub } from '../../clubs/api';
import { handOver, leaveClubStaff, ownerMustHandOver } from './api';
import { useLeaveStep } from './useLeaveStep';
import './leaving.css';

/**
 * One way out of a club's staff: Leave, then, for the Owner, "Hand the club over" (an Admin takes it at once, anyone
 * else accepts first), and for the last staff member "Close the club" with what is kept said plainly. Used on People,
 * beside "Leave {club} first" wherever a second club's job is refused, and by the profile's "Where you are".
 */
export function LeaveClubDialog({ clubId, clubName, onDone }: { clubId: number; clubName: string; onDone: (notice: string, outcome: 'left' | 'handed' | 'closed') => void }) {
    const copy = useJourneyCopy();
    const { user, refreshNavigationCapabilities } = useAuth();
    const { step, go } = useLeaveStep();
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
    const [people, setPeople] = useState<Person[] | null>(null);
    useEffect(() => {
        if (step !== 'handover') return;
        const controller = new AbortController();
        fetchPeople(clubId, controller.signal).then(view => { if (!controller.signal.aborted) setPeople(view.people); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('The club’s people couldn’t load.', 'კლუბის ხალხი ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [step, clubId, copy]);
    if (!step) return null;
    const finish = async (message: string, outcome: 'left' | 'handed' | 'closed') => {
        go(null); refreshAccess();
        await refreshNavigationCapabilities().catch(() => undefined);
        onDone(message, outcome);
    };
    const run = async (work: () => Promise<void>, fallback: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await work(); } catch (failure) { setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    const leave = () => void run(async () => {
        try { await leaveClubStaff(clubId); }
        catch (failure) {
            const owner = ownerMustHandOver(failure);
            if (!owner) throw failure;
            go(owner.lastStaff ? 'close' : 'handover');
            return;
        }
        await finish(copy(`You’ve left ${clubName}. Your jobs there are in your career.`, `${clubName} დატოვეთ. იქაური სამუშაოები თქვენს კარიერაში რჩება.`), 'left');
    }, copy('You couldn’t leave. Try again.', 'ვერ დატოვეთ. სცადეთ ხელახლა.'));
    const give = (person: Person) => void run(async () => {
        const answer = await handOver(clubId, person.userId);
        refreshAccess();
        if (answer.outcome === 'TRANSFERRED') { setNote(copy(`${person.name} owns ${clubName} now; you’re an Admin.`, `${clubName} ახლა ${person.name}-ს ეკუთვნის; თქვენ ადმინი ხართ.`)); go('leave'); }
        else await finish(copy(`${person.name} is asked to take ${clubName} over. You can leave once they accept.`, `${person.name}-ს ეთხოვა ${clubName}-ის მიღება. დატოვებას შეძლებთ, როცა დათანხმდება.`), 'handed');
    }, copy('The club couldn’t be handed over. Try again.', 'კლუბი ვერ გადაეცა. სცადეთ ხელახლა.'));
    const close = () => void run(async () => {
        await closeClub(clubId);
        await finish(copy(`${clubName} is closed. Its records are kept.`, `${clubName} დაიხურა. მისი ჩანაწერები შენახულია.`), 'closed');
    }, copy('The club couldn’t be closed. Try again.', 'კლუბი ვერ დაიხურა. სცადეთ ხელახლა.'));

    const others = (people ?? []).filter(p => p.userId !== user?.id && p.jobs.some(j => j.status === 'ACTIVE'));
    const admins = others.filter(p => p.jobs.some(j => j.kind === 'ADMIN')), rest = others.filter(p => !admins.includes(p));
    const pick = (list: Person[], at: string) => list.map(person => <li key={person.userId}>
        <button type="button" className="lv-pick" disabled={busy} onClick={() => give(person)}>
            <Avatar src={resolveMediaUrl(person.avatarUrl) || null} name={person.name} size={32} />
            <span><strong>{person.name}</strong><small>{at}</small></span>
        </button>
    </li>);
    const title = step === 'handover' ? copy(`Hand ${clubName} over`, `${clubName}-ის გადაცემა`) : step === 'close' ? copy(`Close ${clubName}?`, `დაიხუროს ${clubName}?`) : copy(`Leave ${clubName}?`, `დატოვოთ ${clubName}?`);
    return <Dialog open size="md" role={step === 'close' ? 'alertdialog' : 'dialog'} onClose={() => { if (!busy) go(null); }} title={title}
        description={step === 'handover' ? copy('You own this club, so someone takes it over before you leave.', 'ეს კლუბი თქვენია, ამიტომ წასვლამდე ვინმემ უნდა ჩაიბაროს.')
            : step === 'close' ? copy('You’re the last staff member here.', 'აქ ბოლო თანამშრომელი ხართ.')
                : copy('Your staff jobs here end. What you recorded stays with the club, and your career keeps the jobs.', 'აქაური სამუშაოები სრულდება. რაც ჩაწერეთ, კლუბს რჩება, სამუშაოები კი თქვენს კარიერაში.')}
        footer={step === 'handover' ? <Button variant="ghost" disabled={busy} onClick={() => go(null)}>{copy('Not now', 'ახლა არა')}</Button>
            : <><Button variant="ghost" disabled={busy} onClick={() => go(null)}>{copy('Stay', 'დარჩენა')}</Button>
                {step === 'close' ? <Button variant="danger" disabled={busy} onClick={close}><Lock aria-hidden="true" />{copy('Close the club', 'კლუბის დახურვა')}</Button>
                    : <Button variant="danger" disabled={busy} onClick={leave}><DoorOpen aria-hidden="true" />{copy(`Leave ${clubName}`, `${clubName}-ის დატოვება`)}</Button>}</>}>
        <div className="gk lv-body">
            {note && <p className="gk-notice cw-notices__success" role="status">{note}</p>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            {step === 'handover' && (people === null ? !error && <p className="gk-faint" role="status">{copy('Loading the club’s people…', 'კლუბის ხალხი იტვირთება…')}</p>
                : others.length ? <ul className="lv-picks" aria-label={copy('Who takes the club over', 'ვინ ჩაიბარებს კლუბს')}>
                    {pick(admins, copy('Admin · takes over at once', 'ადმინი · ჩაიბარებს მაშინვე'))}
                    {pick(rest, copy('Accepts first', 'ჯერ დაეთანხმება'))}
                </ul>
                : <div className="lv-empty"><p>{copy('Nobody else works here yet.', 'აქ ჯერ სხვა არავინ მუშაობს.')}</p>
                    <Button onClick={() => go('close')}><Lock aria-hidden="true" />{copy('Close the club instead', 'სანაცვლოდ კლუბის დახურვა')}</Button></div>)}
            {step === 'handover' && <p className="gk-faint lv-hint"><Crown aria-hidden="true" />{copy('To hand it to someone new, invite them on People first.', 'ახალი ადამიანისთვის გადასაცემად ჯერ მოიწვიეთ ის ხალხის გვერდზე.')}</p>}
            {step === 'close' && <ul className="lv-kept">
                <li>{copy('The club leaves listings and every job here ends.', 'კლუბი სიებიდან ქრება და ყველა სამუშაო სრულდება.')}</li>
                <li>{copy('Kept: its sessions, attendance, records and results.', 'შენახულია: ვარჯიშები, დასწრება, ჩანაწერები და შედეგები.')}</li>
                <li>{copy('Players keep their cards, and everyone keeps their career.', 'მოთამაშეებს რჩებათ ბარათები, ყველას — კარიერა.')}</li>
            </ul>}
        </div>
    </Dialog>;
}
