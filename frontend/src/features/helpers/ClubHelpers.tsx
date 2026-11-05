import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { X } from 'lucide-react';
import { Avatar, Button, LoadFailed, Panel, Section } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { clubHelpers, removeClubHelper, type ClubHelper } from './api';
import './helpers.css';

/**
 * Club office › Staff, for its admins: the helpers the squads' head coaches added to sessions (decision 3), each with
 * the squad and session, who added them, and Remove. Shown only when there are some; someone who isn't an admin here
 * (refused) sees nothing, and a list that couldn't load says so, with Try again.
 */
export function ClubHelpers({ clubId }: { clubId: number }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [helpers, setHelpers] = useState<ClubHelper[]>([]), [revision, setRevision] = useState(0), [failed, setFailed] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        void clubHelpers(clubId, controller.signal).then(rows => { if (!controller.signal.aborted) { setHelpers(rows); setFailed(false); } })
            .catch(failure => { if (!controller.signal.aborted) setFailed(!(isAxiosError(failure) && [403, 404].includes(failure.response?.status ?? 0))); });
        return () => controller.abort();
    }, [clubId, revision]);
    if (!helpers.length && !failed) return null;
    const reload = () => setRevision(value => value + 1);
    const remove = async (helper: ClubHelper) => {
        if (!window.confirm(copy(helper.repeating ? 'removeHelperEveryWeekConfirm' : 'removeHelperConfirm', { name: helper.name }))) return;
        try { await removeClubHelper(clubId, helper.id); reload(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('removeHelperFailed'))); }
    };
    const when = (helper: ClubHelper) => helper.startsAt
        ? helper.repeating ? copy('everyWeek', { day: formatDate(helper.startsAt, { weekday: 'long' }), time: formatDate(helper.startsAt, { hour: '2-digit', minute: '2-digit' }) })
            : formatDate(helper.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : null;
    return <Section boxed title={copy('helpers')} hint={copy('helpersHint')}>
        <Panel flush>{failed ? <LoadFailed text={copy('couldntLoad')} retry={copy('tryAgain')} onRetry={reload} />
            : <ul className="hp-club" aria-label={copy('helpers')}>{helpers.map(helper => <li key={helper.id}>
                <Avatar name={helper.name} size={32} />
                <span className="hp-club__who"><strong>{helper.name}</strong><span className="hp-quiet">{[helper.squadName, helper.session, when(helper), copy('addedBy', { name: helper.addedBy })].filter(Boolean).join(' · ')}</span></span>
                <Button size="sm" variant="ghost" onClick={() => void remove(helper)}><X aria-hidden="true" />{copy('remove')}</Button>
            </li>)}</ul>}</Panel>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Section>;
}
