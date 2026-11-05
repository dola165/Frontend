import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { ageOn, firstName, useWorldChild } from '../players';
import { useWorldArea } from '../useWorldArea';
import { useWorldData } from '../useWorldData';
import { useWorldCopy } from '../copy';
import { keepSearch, listSearchWatches, stopSearch, type SearchSpec } from './api';
import { searchReturnPath } from './returnPath';
import './watches.css';

/** A parent's search for their child follows itself; anyone else's search can be followed with one tap. */
export function WatchSearch({ spec, childId, contextChildId }: { spec: SearchSpec | null; childId?: number; contextChildId?: number }) {
    const { status, user } = useAuth();
    const adult = status === 'authenticated' && (ageOn(user?.dob) ?? 0) >= 18;
    if (!adult || !spec) return null;
    return childId ? <FollowedForChild spec={spec} childId={childId} /> : <FollowThisSearch spec={spec} contextChildId={contextChildId} />;
}

/** The search's own return address: the World or Parent Hub page as the parent sees it now, from the private criteria. */
function useReturnPath() {
    const location = useLocation();
    const { area } = useWorldArea();
    return (spec: SearchSpec, childId: number | null, playerId?: number) => {
        const params = new URLSearchParams(location.search);
        params.delete('watch');
        params.set('near', area.anywhere ? 'anywhere' : area.city);
        params.set('player', String(playerId ?? childId ?? 'anyone'));
        return searchReturnPath({ query: spec, returnPath: `${location.pathname}?${params}`, childId });
    };
}

/**
 * A club search for a child with no club is followed as soon as it shows, with no button (owner, 29 October and 2
 * November 2026), until the child has a club: one quiet line says so, with Stop. The server keeps one followed search
 * per child and refuses a child who already has a club; then nothing shows.
 */
function FollowedForChild({ spec, childId }: { spec: SearchSpec; childId: number }) {
    const { sessionId, user } = useAuth();
    const { child } = useWorldChild();
    const t = useWorldCopy();
    const returnPath = useReturnPath();
    const scope = `${sessionId}:${user?.id}`;
    const list = useWorldData(`world-watches:${scope}`, signal => listSearchWatches(sessionId, signal), t('Followed searches could not load.'));
    const identity = JSON.stringify(spec);
    const key = `${scope}:${identity}:${childId}`;
    // Each search is followed by itself once per page visit; after Stop, or when the server refuses, it is left alone.
    const attempted = useRef<string | null>(null);
    const [round, setRound] = useState(0);
    const [failed, setFailed] = useState<string | null>(null);
    const [stopping, setStopping] = useState(false);
    const following = (list.data ?? []).find(item => item.active && item.childId === childId && JSON.stringify(item.query) === identity);
    const ready = Boolean(list.data) && !list.error && !following;
    // A search already followed when the page opened counts as followed: if it ends (Stop, the child joined), it stays ended.
    useEffect(() => { if (following) attempted.current = key; }, [following, key]);
    useEffect(() => {
        if (!ready || attempted.current === key) return;
        attempted.current = key;
        const path = returnPath(spec, childId);
        if (!path) { setFailed(key); return; }
        // Not aborted on cleanup: following is idempotent on the server, and an effect run twice (React's strict
        // mode) must not cancel the one attempt. An answer for a search no longer shown is ignored.
        void keepSearch(spec, path, childId, sessionId, new AbortController().signal)
            .then(() => { if (attempted.current === key) list.retry(); })
            .catch(error => {
                // A child who has a club (or a search the parent may no longer make) is refused: then nothing shows.
                const refused = [403, 404].includes((error as { response?: { status?: number } } | null)?.response?.status ?? 0);
                if (attempted.current === key && !refused) setFailed(key);
            });
        // One attempt per search and child; the list's own reloads never start another, Try again does.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, key, round]);
    const stop = async () => {
        if (!following || stopping) return;
        attempted.current = key;
        setStopping(true);
        try { await stopSearch(following.id, sessionId, new AbortController().signal); list.retry(); }
        catch { setFailed(key); }
        finally { setStopping(false); }
    };
    const retry = () => { attempted.current = null; setFailed(null); setRound(value => value + 1); };
    const name = child?.id === childId ? firstName(child.name) : null;
    if (following) return <p className="gk-world-watches gk-faint" role="status">
        <span>{name ? t('We’ll tell you about new places for {name}', { name }) : t('We’ll tell you about new places for your child')}</span>
        <span aria-hidden="true">·</span>
        <button type="button" className="gk-world-watches__stop" disabled={stopping} onClick={() => void stop()}>{t('Stop')}</button>
    </p>;
    if (failed === key) return <p className="gk-world-watches gk-faint" role="status">
        <span>{t('New places for your child could not be followed.')}</span>
        <button type="button" className="gk-world-watches__stop" onClick={retry}>{t('Try again')}</button>
    </p>;
    return null;
}

function FollowThisSearch({ spec, contextChildId }: { spec: SearchSpec; contextChildId?: number }) {
    const { sessionId, user } = useAuth();
    const t = useWorldCopy();
    const returnPath = useReturnPath();
    const scope = `${sessionId}:${user?.id}`;
    const list = useWorldData(`world-watches:${scope}`, signal => listSearchWatches(sessionId, signal), t('Followed searches could not load.'));
    const identity = JSON.stringify(spec);
    const key = `${scope}:${identity}:${contextChildId ?? ''}`;
    const pending = useRef<AbortController | null>(null);
    const [command, setCommand] = useState<{ key: string; busy: boolean; error: string }>();
    useEffect(() => () => { pending.current?.abort(); pending.current = null; }, [key]);
    const active = (list.data ?? []).filter(item => item.active);
    const existing = active.find(item => JSON.stringify(item.query) === identity && item.childId == null);
    const busy = command?.key === key && command.busy;
    const act = async (stopId?: number) => {
        if (pending.current) return;
        const request = new AbortController(); pending.current = request;
        setCommand({ key, busy: true, error: '' });
        try {
            if (stopId != null) await stopSearch(stopId, sessionId, request.signal);
            else {
                const path = returnPath(spec, null, contextChildId);
                if (!path) throw new Error(t('This search is no longer available.'));
                await keepSearch(spec, path, undefined, sessionId, request.signal);
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
        <span className="gk-faint">{t('New results at most daily. Notification settings apply.')}</span>
        {list.error && <span role="alert">{list.error} <button type="button" onClick={list.retry}>{t('Try again')}</button></span>}
        {command?.key === key && command.error && <span role="alert">{command.error}</span>}
        {active.length > 0 && <details><summary>{t('Followed searches')} ({active.length})</summary>
            <ul>{active.map(item => <li key={item.id}><Link to={`/world/clubs?watch=${item.id}`}>{t('Open saved search')} · {t(item.query.kind === 'CLUBS' ? 'Clubs' : item.query.kind === 'GROUPS' ? 'Training groups' : item.query.kind === 'TRIALS' ? 'Trials' : 'Tournaments')}</Link>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(item.id)}>{t('Stop following')}</Button></li>)}</ul>
        </details>}
    </div>;
}
