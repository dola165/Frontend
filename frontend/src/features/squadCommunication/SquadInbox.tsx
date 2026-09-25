import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MessageCircle, Shield, LockKeyhole } from 'lucide-react';
import * as api from './api';
import { SquadMessages } from './SquadMessages';
import { extractApiErrorMessage } from '../../utils/apiError';
import './squad-inbox.css';
import { squadMessageUrl } from './routes';

export function SquadInboxList({ selected }: { selected: number | null }) {
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
                if (!abort.signal.aborted) { setSpaces([]); setError(extractApiErrorMessage(e, 'Squad conversations could not load.')); setLoading(false); }
            });
        };
        load(); const timer = setInterval(load, 15000);
        return () => { abort.abort(); clearInterval(timer); };
    }, [revision]);
    return <nav className="squad-inbox-list" aria-label="Squad conversations">
        <h3>Your squads</h3>
        {loading && <p role="status">Loading squads…</p>}
        {error && <p role="alert">{error} <button onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
        {!loading && !error && spaces.length === 0 && <p>Your squad conversations appear here when you join a squad.</p>}
        {spaces.map(space => <div key={space.id} className={selected === space.id ? 'is-selected' : ''}>
            <Link to={squadMessageUrl(space.id)} aria-current={selected === space.id ? 'page' : undefined}>
                <Shield size={20} /><span><strong>{space.name}</strong><small>{space.academy_name}</small></span>
            </Link>
            <div className="squad-inbox-shortcuts"><Link to={squadMessageUrl(space.id)}>Squad chat</Link><Link to={squadMessageUrl(space.id, true)}>{space.can_manage ? 'Families & players' : 'Message coach'}</Link></div>
        </div>)}
    </nav>;
}

export function SquadInboxConversation({ id }: { id: number }) {
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
                if (!abort.signal.aborted) { setSpace(null); setError(extractApiErrorMessage(e, 'This squad conversation is unavailable.')); }
            });
        };
        load(); const timer = setInterval(load, 15000);
        return () => { abort.abort(); clearInterval(timer); };
    }, [id, revision]);
    const thread = !coaching ? null : space?.can_manage
        ? space.threads.find(person => person.user_id === requested)?.user_id ?? null : space?.viewer_id ?? null;
    return <div className="squad-page squad-inbox-conversation" data-channel={coaching ? 'coach' : 'squad'}>
        <nav className="squad-return-nav" aria-label="Go back"><Link className="squad-back" to={`/squads/${id}`}><ArrowLeft size={20} />Back to squad</Link><Link className="squad-inbox-back" to="/messages">All messages</Link></nav>
        {error ? <div role="alert" className="squad-empty"><h2>Conversation unavailable</h2><p>{error}</p><button onClick={refresh}>Try again</button></div> : !space ? <p role="status">Opening your squad…</p> : <>
            <header className="squad-inbox-heading"><div><span className="squad-eyebrow">{space.academy_name}</span><h1>{space.name}</h1></div><Link to={`/squads/${id}`}>Schedule & updates <ArrowUpRight size={16} /></Link></header>
            <nav className="squad-inbox-channels" aria-label="Conversation type"><Link aria-current={!coaching ? 'page' : undefined} to={squadMessageUrl(id)}><MessageCircle size={16} />Squad chat</Link><Link aria-current={coaching ? 'page' : undefined} to={squadMessageUrl(id, true)}><LockKeyhole size={16}/>{space.can_manage ? 'Families & players' : 'Message coach'}</Link></nav>
            {coaching && space.can_manage && <label className="squad-inbox-family">Family or player<select aria-label="Family or player" value={thread ?? ''} onChange={e => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('thread', e.target.value); else next.delete('thread');
                setParams(next);
            }}><option value="">Choose a conversation</option>{space.threads.map(person => <option key={person.user_id} value={person.user_id}>{person.full_name}{person.unread_count ? ` (${person.unread_count} unread)` : ''}</option>)}</select></label>}
            {coaching && !thread ? <div className="squad-empty"><h2>Choose a family or player</h2><p>Private conversations are shared only with that person and this squad’s coaching team.</p></div> : <SquadMessages key={`${id}:${thread ?? 'group'}`} space={space} kind="CHAT" thread={thread} onSent={refresh} />}
        </>}
    </div>;
}
