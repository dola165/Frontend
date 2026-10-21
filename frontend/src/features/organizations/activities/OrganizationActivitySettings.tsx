import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { getActivities, updateActivities, type OrganizationCapabilities } from './api';
import { activityCopy, activityError } from './copy';
import { Button, GkRoot, Skeleton } from '../../../design/primitives';
import '../org-tools.css';

export function OrganizationActivitySettings(props: { id: number; onChanged?: (value: OrganizationCapabilities) => void }) {
    const { sessionId } = useAuth();
    return <ActivitySettings key={`${props.id}-${sessionId}`} {...props} />;
}
export function ActivitySettings({ id, onChanged }: { id: number; onChanged?: (value: OrganizationCapabilities) => void }) {
    const { i18n } = useTranslation(), copy = activityCopy(i18n.language);
    const [current, setCurrent] = useState<OrganizationCapabilities | null>(null);
    const [venue, setVenue] = useState(false), [tournament, setTournament] = useState(false);
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
    const [error, setError] = useState(''), [message, setMessage] = useState(''), [needsReload, setNeedsReload] = useState(false);
    const alive = useRef(false), submitting = useRef(false);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setCurrent(null);
        void getActivities(id, controller.signal).then(value => {
            if (controller.signal.aborted) return;
            setCurrent(value); setVenue(value.enabledActivities.includes('VENUE')); setTournament(value.enabledActivities.includes('TOURNAMENT')); setNeedsReload(false);
        }).catch(err => { if (!controller.signal.aborted) setError(activityError(err, copy)); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [id, reload, copy]);
    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!current?.canConfigureActivities || submitting.current || needsReload) return;
        submitting.current = true; setBusy(true); setError(''); setMessage('');
        try {
            const value = await updateActivities(id, { revision: current.revision, venueEnabled: venue, tournamentEnabled: tournament });
            if (!alive.current) return;
            setCurrent(value); setMessage(copy.saved); onChanged?.(value);
        } catch (err) {
            if (!alive.current) return;
            setError(activityError(err, copy));
            const status = (err as { response?: { status?: number } })?.response?.status;
            if ([401, 403, 404, 409].includes(status ?? 0)) setNeedsReload(true);
        } finally { submitting.current = false; if (alive.current) setBusy(false); }
    };
    return <GkRoot className="org-tool"><section className="org-tool__section" aria-labelledby={`activities-${id}`}>
        <header className="org-tool__head"><div><h2 id={`activities-${id}`} className="org-tool__title">{copy.title}</h2>{current && <p className="org-tool__hint">{copy.profile} · {copy.always}</p>}</div></header>
        {loading ? <div role="status" aria-label={copy.loading}><Skeleton height={88} /></div> : current && <form className="org-tool__form" onSubmit={save}>
            <fieldset className="org-tool__fieldset" disabled={busy || needsReload || !current.canConfigureActivities}>
                <label className="org-tool__switch"><input type="checkbox" className="gk-switch" checked={venue} onChange={e => setVenue(e.target.checked)} /><span>{copy.venue}</span></label>
                <label className="org-tool__switch"><input type="checkbox" className="gk-switch" checked={tournament} onChange={e => setTournament(e.target.checked)} /><span>{copy.tournament}</span></label>
                <p className="org-tool__hint">{copy.help}</p>
                {current.canConfigureActivities && <div><Button type="submit" variant="primary">{busy ? copy.saving : copy.save}</Button></div>}
            </fieldset>
        </form>}
        {error && <div className="gk-notice gk-notice--danger"><span role="alert" className="org-tool__grow">{error}</span><Button size="sm" disabled={busy} onClick={() => { setMessage(''); setReload(v => v + 1); }}>{copy.retry}</Button></div>}
        {message && <p className="gk-notice" role="status">{message}</p>}
    </section></GkRoot>;
}
