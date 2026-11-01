import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HelperEmailWait } from '../../components/auth/EmailWait';
import { needsConfirmedEmail } from '../../components/auth/emailConfirmation';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { requestDestination, type RequestItem } from '../requests/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { answerHomeHelper, loadHomePending } from './homePendingApi';
import { HomeJoinActions } from './HomeJoinActions';
import { HomeResultAction } from './HomeResultAction';
import { homeInboxRead } from './homePendingSignals';
import './waiting-on-you.css';

export function WaitingOnYou() {
    const { sessionId, status } = useAuth();
    return status === 'authenticated' ? <Waiting key={sessionId} session={sessionId} /> : null;
}

function Waiting({ session }: { session: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const [data, setData] = useState<Awaited<ReturnType<typeof loadHomePending>> | null>(null);
    const [failed, setFailed] = useState(false), [round, setRound] = useState(0), [expanded, setExpanded] = useState(false);
    const refresh = () => setRound(n => n + 1);
    useEffect(() => {
        const abort = new AbortController();
        void loadHomePending(session, abort.signal).then(result => { if (!abort.signal.aborted) { setData(result); setFailed(false); } })
            .catch(() => { if (!abort.signal.aborted) { setFailed(true); setData(null); } });
        return () => abort.abort();
    }, [session, round]);
    useEffect(() => {
        const update = () => setRound(n => n + 1);
        const inboxRead = (event: Event) => { if ((event as CustomEvent<{ session: AuthSessionId }>).detail?.session === session) update(); };
        window.addEventListener(homeInboxRead, inboxRead);
        window.addEventListener('requests-updated', update); window.addEventListener('focus', update); window.addEventListener('online', update);
        return () => { window.removeEventListener(homeInboxRead, inboxRead); window.removeEventListener('requests-updated', update); window.removeEventListener('focus', update); window.removeEventListener('online', update); };
    }, [session]);
    const changed = () => window.dispatchEvent(new Event('requests-updated'));
    const all = expanded || params.has('helper') || params.has('projectHelper');
    if (data && !data.items.length && !data.partial && !failed) return null;
    return <section className="home-waiting" data-expanded={all || undefined} aria-label={copy('Waiting on you', 'თქვენ გელოდებათ')}>
        {!data && !failed && <p role="status">{copy('Checking what needs you…', 'მომლოდინე საქმეები მოწმდება…')}</p>}
        {(failed || data?.partial) && <p role="alert">{copy('Some requests could not load.', 'ზოგი მოთხოვნა ვერ ჩაიტვირთა.')} <button type="button" onClick={refresh}>{copy('Retry', 'ხელახლა ცდა')}</button></p>}
        <ul>{(all ? data?.items : data?.items.slice(0, 1))?.map(item => <li key={item.key}>
            <span className="home-waiting__dot" aria-hidden="true" />
            <div className="home-waiting__body"><strong>{title(item, copy)}</strong><small>{item.context}</small>
                {item.family === 'SQUAD_JOIN_REQUESTS' ? <HomeJoinActions squad={item.id} session={session} changed={changed} />
                    : item.family === 'MATCH_RESULT' ? <HomeResultAction item={item} session={session} changed={changed} />
                        : ['SESSION_HELPER', 'PROJECT_HELPER'].includes(item.family) ? <HelperAnswer item={item} session={session} changed={changed} />
                            : requestDestination(item.destination, item.family) && <Link to={requestDestination(item.destination, item.family)!}>{copy('Open', 'გახსნა')}</Link>}
            </div>
        </li>)}</ul>
        {!all && (data?.items.length ?? 0) > 1 && <button type="button" aria-expanded={false} onClick={() => setExpanded(true)}>{copy(`+ ${data!.items.length - 1} more`, `+ კიდევ ${data!.items.length - 1}`)}</button>}
        {all && !params.size && <button type="button" aria-expanded onClick={() => setExpanded(false)}>{copy('Show less', 'ნაკლების ჩვენება')}</button>}
    </section>;
}

function title(item: RequestItem, copy: ReturnType<typeof useJourneyCopy>) {
    if (item.family === 'SQUAD_JOIN_REQUESTS') return copy(item.title, `${item.title.split(' ')[0]} მსურველი გაწევრიანებას ელოდება`);
    if (item.family === 'STAFF_CLUB_CHOICE') return copy('Choose your staff club', 'აირჩიეთ თქვენი კლუბი');
    if (item.family === 'SESSION_HELPER_WORK') return copy('Finish the session register', 'დაასრულეთ ვარჯიშის აღრიცხვა');
    if (item.family === 'MATCH_RESULT') return copy(item.title, item.actionLabel === 'CONFIRM' ? 'დაადასტურეთ შედეგი' : item.actionLabel === 'SETTLE' ? 'გადაწყვიტეთ შედეგი' : 'შეიყვანეთ შედეგი');
    if (['SESSION_HELPER', 'PROJECT_HELPER'].includes(item.family)) return copy('Invitation to help', 'დახმარების მოწვევა');
    return item.title;
}

function HelperAnswer({ item, session, changed }: { item: RequestItem; session: AuthSessionId; changed: () => void }) {
    const copy = useJourneyCopy(); const navigate = useNavigate();
    const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [email, setEmail] = useState(item.destination === '/account');
    const controller = useRef<AbortController | null>(null), submitting = useRef(false);
    useEffect(() => () => controller.current?.abort(), []);
    const answer = async (accept: boolean) => {
        if (submitting.current || !isCurrentAuthSession(session)) return;
        const abort = new AbortController(); controller.current = abort;
        submitting.current = true; setBusy(true); setFailed(false);
        try {
            await answerHomeHelper(item, accept, session, abort.signal);
            if (abort.signal.aborted || !isCurrentAuthSession(session)) return;
            changed(); if (accept) navigate(item.family === 'PROJECT_HELPER' ? `/projects/${item.id}` : `/home?helping=${item.id}`);
        } catch (error) { if (!abort.signal.aborted && isCurrentAuthSession(session)) { setEmail(needsConfirmedEmail(error)); setFailed(true); } }
        finally { if (!abort.signal.aborted && isCurrentAuthSession(session)) { setBusy(false); submitting.current = false; } }
    };
    if (email) return <HelperEmailWait what={null} next="/home" />;
    return <div className="home-waiting__actions"><button type="button" disabled={busy} onClick={() => void answer(true)}>{copy('Accept', 'მიღება')}</button>
        <button type="button" disabled={busy} onClick={() => void answer(false)}>{copy('Not for me', 'ჩემთვის არაა')}</button>
        {failed && <p role="alert">{copy('The answer was not confirmed. Refresh or retry.', 'პასუხი არ დადასტურდა. განაახლეთ ან სცადეთ ხელახლა.')} <button type="button" onClick={changed}>{copy('Reload requests', 'მოთხოვნების განახლება')}</button></p>}
    </div>;
}
