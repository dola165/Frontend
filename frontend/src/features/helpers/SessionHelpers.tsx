import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { UserPlus, X } from 'lucide-react';
import { Avatar, Button, LoadFailed, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { AddHelperDialog } from './AddHelperDialog';
import { removeHelper, sessionHelpers, type SessionHelper } from './api';
import './helpers.css';

/**
 * A session's helpers, inside the session's summary in My squads: the same block for everyone on the squad, who helps,
 * every week or this date (or nobody yet). Only Add and Remove follow the job (`canManage`: the squad's head coach, the
 * head of coaching, admins). A refusal (403/404) means the session's helpers aren't this person's to see.
 */
export function SessionHelpers({ squad, squadName, session, canManage }: {
    squad: number; squadName: string; session: { id: number; title: string; starts_at: string; series_id?: string | null }; canManage: boolean;
}) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [helpers, setHelpers] = useState<SessionHelper[] | null>(null), [revision, setRevision] = useState(0);
    const [failed, setFailed] = useState<'no' | 'yes' | 'not yours'>('no'), [adding, setAdding] = useState(false), [removeFailure, setRemoveFailure] = useState<unknown>(null);
    useEffect(() => {
        const controller = new AbortController();
        void sessionHelpers(squad, session.id, controller.signal).then(rows => { if (!controller.signal.aborted) { setHelpers(rows); setFailed('no'); } })
            .catch(error => { if (!controller.signal.aborted) setFailed(isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0) ? 'not yours' : 'yes'); });
        return () => controller.abort();
    }, [squad, session.id, revision]);
    const reload = () => setRevision(value => value + 1);
    const remove = async (helper: SessionHelper) => {
        // A repeating session's helper helps every week: Remove takes them off every week, and says so.
        if (!window.confirm(copy(helper.repeating ? 'removeHelperEveryWeekConfirm' : 'removeHelperConfirm', { name: helper.name }))) return;
        setRemoveFailure(null);
        try { await removeHelper(squad, helper.id); reload(); }
        catch (failure) { setRemoveFailure(failure); }
    };
    if (failed === 'not yours') return null;
    return <div className="hp-session">
        <div className="hp-session__head"><strong>{copy('helpers')}</strong>
            {canManage && <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><UserPlus aria-hidden="true" />{copy('addHelper')}</Button>}
        </div>
        {failed === 'yes' ? <LoadFailed text={copy('couldntLoad')} retry={copy('tryAgain')} onRetry={reload} />
            : !helpers ? <Skeleton height={26} width="60%" />
            : helpers.length ? <ul className="hp-session__list">{helpers.map(helper => <li key={helper.id}>
                <Avatar name={helper.name} size={26} />
                <span className="hp-session__who"><span>{helper.name}</span><span className="hp-quiet">{[copy(helper.repeating ? 'everyWeekShort' : 'thisDateShort'), helper.waiting ? copy('notSetUpYet') : null].filter(Boolean).join(' · ')}</span></span>
                {canManage && <Button size="sm" variant="ghost" iconOnly aria-label={copy('removeHelper', { name: helper.name })} title={copy('removeHelper', { name: helper.name })} onClick={() => void remove(helper)}><X aria-hidden="true" /></Button>}
            </li>)}</ul> : <p className="hp-quiet">{copy('noHelpers')}</p>}
        {removeFailure !== null && <p className="gk-notice gk-notice--danger" role="alert">{extractApiErrorMessage(removeFailure, copy('removeHelperFailed'))}</p>}
        {adding && <AddHelperDialog squad={squad} squadName={squadName} session={session} onClose={() => setAdding(false)} onAdded={reload} />}
    </div>;
}
