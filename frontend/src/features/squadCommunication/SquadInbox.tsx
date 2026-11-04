import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MessageCircle, Shield, LockKeyhole } from 'lucide-react';
import * as api from './api';
import { SquadMessages } from './SquadMessages';
import { SquadRoomTabs } from './SquadRooms';
import { activeRoom } from './squadRoomWords';
import { AddMyParent } from '../../components/auth/AddMyParent';
import { extractApiErrorMessage } from '../../utils/apiError';
import './squad-inbox.css';
import { squadMessageUrl } from './routes';
import { useJourneyCopy } from './journeyCopy';

export function SquadInboxList({ selected }: { selected: number | null }) {
    const copy = useJourneyCopy();
    const [spaces, setSpaces] = useState<api.SquadSpace[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const abort = new AbortController();
        const load = () => {
            if (document.hidden) return;
            void api.spaces(abort.signal).then(rows => {
                if (!abort.signal.aborted) { setSpaces(rows); setError(''); setLoading(false); }
            }).catch(e => {
                if (!abort.signal.aborted) { setSpaces([]); setError(extractApiErrorMessage(e, copy('Squad conversations could not load.', 'გუნდის საუბრები ვერ ჩაიტვირთა.'))); setLoading(false); }
            });
        };
        load(); const timer = setInterval(load, 15000);
        return () => { abort.abort(); clearInterval(timer); };
    }, [revision, copy]);
    return <nav className="squad-inbox-list" aria-label={copy('Squad conversations', 'გუნდის საუბრები')}>
        <h3>{copy('Your squads', 'თქვენი გუნდები')}</h3>
        {loading && <p role="status">{copy('Loading squads…', 'გუნდები იტვირთება…')}</p>}
        {error && <p role="alert">{error} <button onClick={() => setRevision(n => n + 1)}>{copy('Retry', 'ხელახლა ცდა')}</button></p>}
        {!loading && !error && spaces.length === 0 && <p>{copy('Your squad conversations appear here when you join a squad.', 'გუნდში გაწევრიანების შემდეგ საუბრები აქ გამოჩნდება.')}</p>}
        {spaces.map(space => <div key={space.id} className={selected === space.id ? 'is-selected' : ''}>
            <Link to={squadMessageUrl(space.id)} aria-current={selected === space.id ? 'page' : undefined}>
                <Shield size={20} /><span><strong>{space.name}</strong><small>{space.academy_name}</small></span>
            </Link>
            <div className="squad-inbox-shortcuts"><Link to={squadMessageUrl(space.id)}>{copy('Squad chat', 'გუნდის ჩატი')}</Link><Link to={squadMessageUrl(space.id, true)}>{space.can_manage ? copy('Families & players', 'ოჯახები და მოთამაშეები') : copy('Message coach', 'მწვრთნელთან მიწერა')}</Link></div>
        </div>)}
    </nav>;
}

export function SquadInboxConversation({ id }: { id: number }) {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const [space, setSpace] = useState<api.SquadOverview | null>(null);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const coaching = params.get('channel') === 'coach';
    const requested = Number(params.get('thread'));
    const refresh = () => setRevision(n => n + 1);
    useEffect(() => {
        const abort = new AbortController();
        const load = () => {
            if (document.hidden) return;
            void api.overview(id, abort.signal).then(value => {
                if (!abort.signal.aborted) { setSpace(value); setError(''); }
            }).catch(e => {
                if (!abort.signal.aborted) { setSpace(null); setError(extractApiErrorMessage(e, copy('This squad conversation is unavailable.', 'გუნდის საუბარი მიუწვდომელია.'))); }
            });
        };
        load(); const timer = setInterval(load, 15000);
        return () => { abort.abort(); clearInterval(timer); };
    }, [id, revision, copy]);
    // A parent is in the private thread of their 13-17 child in this squad too.
    const children = space?.can_manage ? [] : space?.child_threads ?? [];
    const childThread = children.find(child => child.user_id === requested)?.user_id ?? null;
    const requestedUnavailable = coaching && params.has('thread') && !!space
        && (!Number.isSafeInteger(requested) || requested <= 0 || (space.can_manage
            ? !space.threads.some(person => person.user_id === requested)
            : requested !== space.viewer_id && childThread === null));
    const thread = !coaching ? null : space?.can_manage
        ? space.threads.find(person => person.user_id === requested)?.user_id ?? null : childThread ?? space?.viewer_id ?? null;
    const guardiansCanView = space?.can_manage ? Boolean(space.threads.find(person => person.user_id === thread)?.guardians_can_view)
        : childThread !== null || Boolean(space?.viewer_thread_guardians_can_view);
    const room = space && !coaching ? activeRoom(space, params.get('room')) : null;
    // A player under 18 with no parent here: coaches reach them only in the players' room.
    const threadNeedsParent = coaching && !!space && (space.can_manage ? Boolean(space.threads.find(person => person.user_id === thread)?.needs_parent) : childThread === null && Boolean(space.viewer_needs_parent));
    return <div className="squad-page squad-inbox-conversation" data-channel={coaching ? 'coach' : 'squad'}>
        <nav className="squad-return-nav" aria-label={copy('Go back', 'უკან')}><Link className="squad-back" to={`/squads/${id}`}><ArrowLeft size={20} />{copy('Back to squad', 'გუნდზე დაბრუნება')}</Link><Link className="squad-inbox-back" to="/messages">{copy('All messages', 'ყველა შეტყობინება')}</Link></nav>
        {error ? <div role="alert" className="squad-empty"><h2>{copy('Conversation unavailable', 'საუბარი მიუწვდომელია')}</h2><p>{error}</p><button onClick={refresh}>{copy('Try again', 'ხელახლა ცდა')}</button></div> : !space ? <p role="status">{copy('Opening your squad…', 'გუნდი იხსნება…')}</p> : <>
            <header className="squad-inbox-heading"><div><span className="squad-eyebrow">{space.academy_name}</span><h1>{space.name}</h1></div><Link to={`/squads/${id}`}>{copy('Schedule & updates', 'განრიგი და განახლებები')} <ArrowUpRight size={16} /></Link></header>
            <nav className="squad-inbox-channels" aria-label={copy('Conversation type', 'საუბრის ტიპი')}><Link aria-current={!coaching ? 'page' : undefined} to={squadMessageUrl(id)}><MessageCircle size={16} />{copy('Squad chat', 'გუნდის ჩატი')}</Link><Link aria-current={coaching ? 'page' : undefined} to={squadMessageUrl(id, true)}><LockKeyhole size={16}/>{space.can_manage ? copy('Families & players', 'ოჯახები და მოთამაშეები') : copy('Message coach', 'მწვრთნელთან მიწერა')}</Link></nav>
            {coaching && space.can_manage && <label className="squad-inbox-family">{copy('Family or player', 'ოჯახი ან მოთამაშე')}<select aria-label={copy('Family or player', 'ოჯახი ან მოთამაშე')} value={thread ?? ''} onChange={e => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('thread', e.target.value); else next.delete('thread');
                setParams(next);
            }}><option value="">{copy('Choose a conversation', 'აირჩიეთ საუბარი')}</option>{space.threads.map(person => <option key={person.user_id} value={person.user_id}>{person.full_name}{person.unread_count ? copy(` (${person.unread_count} unread)`, ` (${person.unread_count} წაუკითხავი)`) : ''}</option>)}</select></label>}
            {coaching && children.length > 0 && <label className="squad-inbox-family">{copy('Conversation', 'საუბარი')}<select aria-label={copy('Conversation', 'საუბარი')} value={childThread ?? ''} onChange={e => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('thread', e.target.value); else next.delete('thread');
                setParams(next);
            }}><option value="">{copy('My conversation with the coaches', 'ჩემი საუბარი მწვრთნელებთან')}</option>{children.map(child => <option key={child.user_id} value={child.user_id}>{copy(`${child.full_name ?? 'Your child'} with the coaches`, `${child.full_name ?? 'თქვენი შვილი'} მწვრთნელებთან`)}</option>)}</select></label>}
            {requestedUnavailable ? <div className="squad-empty" role="alert"><h2>{copy('Conversation unavailable', 'საუბარი მიუწვდომელია')}</h2><p>{copy('That conversation is no longer available to you. Choose another conversation above.', 'ეს საუბარი აღარ არის ხელმისაწვდომი. აირჩიეთ სხვა საუბარი ზემოთ.')}</p></div> : coaching && !thread ? <div className="squad-empty"><h2>{copy('Choose a family or player', 'აირჩიეთ ოჯახი ან მოთამაშე')}</h2><p>{copy('Private conversations are shared only with that person and this squad’s coaching team.', 'პირადი საუბარი მხოლოდ ამ ადამიანს და გუნდის მწვრთნელებს შორისაა.')}</p></div> : <>{!coaching && <SquadRoomTabs space={space} room={room} roomUrl={item => squadMessageUrl(id, false, null, item)} onChanged={refresh} />}<SquadMessages key={`${id}:${thread ?? 'group'}:${room ?? 'one'}`} space={space} kind="CHAT" thread={thread} room={room} asParent={coaching && childThread !== null} guardiansCanView={coaching && guardiansCanView} closed={threadNeedsParent} closedLine={<div className="squad-thread-ask" role="status">{space.can_manage ? <p>{copy('This player has no parent here yet. Write in the squad’s players’ room.', 'ამ მოთამაშის მშობელი აქ ჯერ არ არის. მისწერეთ გუნდის მოთამაშეების ოთახში.')}</p> : <><p>{copy('Add your parent so coaches can message you.', 'დაამატეთ მშობელი, რომ მწვრთნელებმა შეძლონ თქვენთვის მიწერა.')}</p><AddMyParent waiting={false} /></>}</div>} onSent={refresh} /></>}
        </>}
    </div>;
}
