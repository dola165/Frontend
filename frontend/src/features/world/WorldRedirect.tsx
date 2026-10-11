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
export function WorldRedirect({ to, rename, set, detail }: {
    to: string; rename?: Record<string, string>; set?: Record<string, string>;
    /** An old list link that selected one record (`/jobs?job=5`) opens that record's own page. */ detail?: { key: string; path: string };
}) {
    const location = useLocation();
    const selected = detail && new URLSearchParams(location.search).get(detail.key);
    if (detail && selected && /^[1-9]\d*$/.test(selected)) return <Navigate replace to={`${detail.path}/${selected}`} state={location.state} />;
    const params = renamed(new URLSearchParams(location.search), rename ?? {});
    for (const [key, value] of Object.entries(set ?? {})) if (!params.has(key)) params.set(key, value);
    return <Navigate replace to={target(to, params, location.hash)} state={location.state} />;
}

/** An old distance search (latitude and longitude keys) becomes World's "Near me" position. */
function around(params: URLSearchParams, latKey: string, lngKey: string) {
    const rawLat = params.get(latKey), rawLng = params.get(lngKey);
    [latKey, lngKey, 'radiusKm'].forEach(key => params.delete(key));
    const lat = Number(rawLat), lng = Number(rawLng);
    if (rawLat && rawLng && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) params.set('around', `${lat},${lng}`);
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
        const kind = params.get('kind') ?? params.get('hostKind'), host = params.get('host') ?? params.get('hostId');
        ['kind', 'host', 'hostKind', 'hostId'].forEach(key => params.delete(key));
        if (kind && host && (view === 'hosts' || !view)) params.set('host', `${kind}:${host}`);
        else if (view === 'mine' || view === 'hosts' || view === 'invitations') params.set('tab', view);
        around(params, 'latitude', 'longitude');
        return <Navigate replace to={target('/world/competitions', params, location.hash)} state={location.state} />;
    }
    if (section === 'officials') {
        params.delete('tab');
        if (hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace') && params.has('competitionAppointment')) {
            return <Navigate replace to={target('/referees/me', params, '#invitations')} />;
        }
        for (const key of [...params.keys()]) if (!['q', 'format', 'volunteer'].includes(key)) params.delete(key);
        if (params.get('volunteer') !== 'true') params.delete('volunteer');
        params.set('tab', 'referees');
        return <Navigate replace to={target('/world/people', params, location.hash)} state={location.state} />;
    }
    if (section === 'find') {
        params.set('tab', params.get('tab') === 'mine' ? 'mine' : 'exchange');
        around(params, 'lat', 'lng');
    } else if (section === 'fixtures') {
        params.delete('tab');
        // Match history, and the hub's fixtures section, opened on past results by default.
        if (!params.get('period')) params.set('period', 'HISTORY');
    }
    return <Navigate replace to={target('/world/matches', params, location.hash)} state={location.state} />;
}
