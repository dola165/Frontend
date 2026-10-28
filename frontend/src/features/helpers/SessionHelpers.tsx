import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Avatar, Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { AddHelperDialog } from './AddHelperDialog';
import { removeHelper, sessionHelpers, type SessionHelper } from './api';
import './helpers.css';

/**
 * A session's helpers, inside the session's summary in My squads, for whoever may add them there (the squad's head
 * coach, the head of coaching, admins): who helps, every week or this date, with Remove, and Add a helper.
 */
export function SessionHelpers({ squad, squadName, session }: { squad: number; squadName: string; session: { id: number; title: string; starts_at: string; series_id?: string | null } }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [helpers, setHelpers] = useState<SessionHelper[] | null>(null), [revision, setRevision] = useState(0);
    const [adding, setAdding] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        void sessionHelpers(squad, session.id, controller.signal).then(rows => { if (!controller.signal.aborted) setHelpers(rows); })
            .catch(failure => { if (!controller.signal.aborted) { setHelpers([]); setError(extractApiErrorMessage(failure, copy('helpersFailed'))); } });
        return () => controller.abort();
    }, [squad, session.id, revision, copy]);
    const remove = async (helper: SessionHelper) => {
        if (!window.confirm(copy('removeHelperConfirm', { name: helper.name }))) return;
        try { await removeHelper(squad, helper.id); setRevision(value => value + 1); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('helpersFailed'))); }
    };
    return <div className="hp-session">
        <div className="hp-session__head"><strong>{copy('helpers')}</strong>
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><UserPlus aria-hidden="true" />{copy('addHelper')}</Button>
        </div>
        {helpers?.length ? <ul className="hp-session__list">{helpers.map(helper => <li key={helper.id}>
            <Avatar name={helper.name} size={26} />
            <span className="hp-session__who"><span>{helper.name}</span><span className="ch-quiet">{[copy(helper.repeating ? 'everyWeekShort' : 'thisDateShort'), helper.waiting ? copy('notSetUpYet') : null].filter(Boolean).join(' · ')}</span></span>
            <Button size="sm" variant="ghost" iconOnly aria-label={copy('removeHelper', { name: helper.name })} title={copy('removeHelper', { name: helper.name })} onClick={() => void remove(helper)}><X aria-hidden="true" /></Button>
        </li>)}</ul> : helpers && <p className="ch-quiet">{copy('noHelpers')}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {adding && <AddHelperDialog squad={squad} squadName={squadName} session={session} onClose={() => setAdding(false)} onAdded={() => setRevision(value => value + 1)} />}
    </div>;
}
