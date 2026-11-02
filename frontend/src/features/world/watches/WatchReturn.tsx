import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { readSearchWatch } from './api';
import { useWorldData } from '../useWorldData';
import { useWorldCopy } from '../copy';
import { worldWatchLink } from '../../../utils/notificationDestinations';
import { searchReturnPath } from './returnPath';

/** Notice URLs contain an opaque watch ID only. Its private destination is resolved for this login. */
export function WatchReturn() {
    const { sessionId, status, user } = useAuth();
    const [params] = useSearchParams();
    const id = params.get('watch');
    const location = useLocation();
    const valid = Boolean(worldWatchLink(location.pathname + location.search + location.hash));
    const navigate = useNavigate();
    const t = useWorldCopy();
    const result = useWorldData(status === 'authenticated' && valid ? `watch-return:${sessionId}:${user?.id}:${id}` : null,
        signal => readSearchWatch(id!, sessionId, signal), t('This search is no longer available.'));
    const path = result.data?.active && String(result.data.id) === id ? searchReturnPath(result.data) : null;
    useEffect(() => { if (path) navigate(path, { replace: true }); }, [path, navigate]);
    if (!params.has('watch')) return null;
    const error = !valid || result.data && !path ? t('This search is no longer available.') : result.error;
    return <p role={error ? 'alert' : 'status'}>{status !== 'authenticated' ? t('Sign in to open your followed search.') : error || t('Opening your search…')}
        {result.error && <button type="button" onClick={result.retry}>{t('Try again')}</button>}</p>;
}
