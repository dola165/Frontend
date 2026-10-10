import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';

const target = (pathname: string, params: URLSearchParams, hash = '') => {
    const search = params.toString();
    return { pathname, search: search ? `?${search}` : '', hash };
};

const renamed = (params: URLSearchParams, rename: Record<string, string>) => {
    for (const [from, into] of Object.entries(rename)) {
        const values = params.getAll(from);
        if (!values.length) continue;
        params.delete(from);
        values.forEach(value => params.append(into, value));
    }
    return params;
};

/**
 * Sends an old discovery URL to its World page, keeping the query string and hash.
 * `rename` maps old query keys to their World names (for example `search` → `q`);
 * `set` adds World keys such as the directory tab.
 */
export function WorldRedirect({ to, rename, set }: { to: string; rename?: Record<string, string>; set?: Record<string, string> }) {
    const location = useLocation();
    const params = renamed(new URLSearchParams(location.search), rename ?? {});
    for (const [key, value] of Object.entries(set ?? {})) if (!params.has(key)) params.set(key, value);
    return <Navigate replace to={target(to, params, location.hash)} state={location.state} />;
}

/**
 * The old Matches & Competitions hub (`/matches?section=…`), Match exchange and Match history.
 * Discovery now lives in World › Matches and Competitions; a referee's own appointments
 * stay in the referee workspace.
 */
export function LegacyMatchesRedirect({ kind }: { kind: 'hub' | 'exchange' | 'history' | 'competitions' }) {
    const location = useLocation();
    const { user } = useAuth();
    const params = new URLSearchParams(location.search);
    const section = kind === 'history' ? 'fixtures' : kind === 'competitions' ? 'competitions'
        : kind === 'exchange' ? (params.get('tab') === 'referees' ? 'officials' : 'find') : params.get('section') ?? 'overview';
    params.delete('section');
    if (section === 'competitions') {
        const view = params.get('view');
        params.delete('view');
        const kind = params.get('kind'), host = params.get('host');
        params.delete('kind');
        params.delete('host');
        if (view === 'hosts' && kind && host) params.set('host', `${kind}:${host}`);
        else if (view === 'mine' || view === 'hosts' || view === 'invitations') params.set('tab', view);
        return <Navigate replace to={target('/world/competitions', params, location.hash)} state={location.state} />;
    }
    if (section === 'officials') {
        params.delete('tab');
        if (hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace') && params.has('competitionAppointment')) {
            return <Navigate replace to={target('/referees/me', params, '#invitations')} />;
        }
        for (const key of [...params.keys()]) if (!['q', 'format', 'volunteer'].includes(key)) params.delete(key);
        params.set('role', 'REFEREE');
        return <Navigate replace to={target('/world/people', params, location.hash)} state={location.state} />;
    }
    if (section === 'find') {
        params.set('tab', params.get('tab') === 'mine' ? 'mine' : 'exchange');
    } else if (section === 'fixtures') {
        params.delete('tab');
        // Match history opened on past results by default.
        if (kind === 'history' && !params.get('period')) params.set('period', 'HISTORY');
    }
    return <Navigate replace to={target('/world/matches', params, location.hash)} state={location.state} />;
}
