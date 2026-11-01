import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { ageOn } from '../players';
import { useWorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';
import { useWorldCopy } from '../copy';
import { keepSearch, listSearchWatches, stopSearch, type SearchSpec } from './api';
import { searchReturnPath } from './returnPath';
import './watches.css';

export function WatchSearch({ spec, childId, contextChildId }: { spec: SearchSpec | null; childId?: number; contextChildId?: number }) {
    const { status, sessionId, user } = useAuth();
    const location = useLocation();
    const { area } = useWorldArea();
    const t = useWorldCopy();
    const adult = status === 'authenticated' && (ageOn(user?.dob) ?? 0) >= 18;
    const scope = `${sessionId}:${user?.id}`;
    const list = useWorldData(adult ? `world-watches:${scope}` : null, signal => listSearchWatches(sessionId, signal), t('Followed searches could not load.'));
    const identity = JSON.stringify(spec);
    const key = `${scope}:${identity}:${childId ?? ''}:${contextChildId ?? ''}`;
    const pending = useRef<AbortController | null>(null);
    const [command, setCommand] = useState<{ key: string; busy: boolean; error: string }>();
    useEffect(() => () => { pending.current?.abort(); pending.current = null; }, [key]);
    if (!adult || !spec) return null;
    const active = (list.data ?? []).filter(item => item.active);
    const existing = active.find(item => JSON.stringify(item.query) === identity && (item.childId ?? undefined) === childId);
    const busy = command?.key === key && command.busy;
    const act = async (stopId?: number) => {
        if (pending.current) return;
        const request = new AbortController(); pending.current = request;
        setCommand({ key, busy: true, error: '' });
        try {
            if (stopId != null) await stopSearch(stopId, sessionId, request.signal);
            else {
                const params = new URLSearchParams(location.search);
                params.delete('watch');
                params.set('near', area.anywhere ? 'anywhere' : area.city);
                params.set('player', String(contextChildId ?? childId ?? 'anyone'));
                const path = searchReturnPath({ query: spec, returnPath: `${location.pathname}?${params}`, childId: childId ?? null });
                if (!path) throw new Error(t('This search is no longer available.'));
                await keepSearch(spec, path, childId, sessionId, request.signal);
            }
            if (!request.signal.aborted) { list.retry(); setCommand({ key, busy: false, error: '' }); }
        } catch (error) {
            if (!request.signal.aborted) setCommand({ key, busy: false, error: extractApiErrorMessage(error, t('The search could not be saved. Try again.')) });
        } finally { if (pending.current === request) pending.current = null; }
    };
    return <div className="gk-world-watches">
        <Button size="sm" variant="ghost" disabled={busy || list.loading || Boolean(list.error)} onClick={() => void act(existing?.id)}>
            {t(busy ? 'Saving…' : existing ? 'Stop following this search' : 'Follow this search')}
        </Button>
        <span className="gk-faint">{t(childId ? 'New results at most daily, until your child joins.' : 'New results at most daily. Notification settings apply.')}</span>
        {list.error && <span role="alert">{list.error} <button type="button" onClick={list.retry}>{t('Try again')}</button></span>}
        {command?.key === key && command.error && <span role="alert">{command.error}</span>}
        {active.length > 0 && <details><summary>{t('Followed searches')} ({active.length})</summary>
            <ul>{active.map(item => <li key={item.id}><Link to={`/world/clubs?watch=${item.id}`}>{t('Open saved search')} · {t(item.query.kind === 'CLUBS' ? 'Clubs' : item.query.kind === 'GROUPS' ? 'Training groups' : item.query.kind === 'TRIALS' ? 'Trials' : 'Tournaments')}</Link>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(item.id)}>{t('Stop following')}</Button></li>)}</ul>
        </details>}
    </div>;
}
