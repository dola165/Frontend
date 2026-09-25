import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { getActivities, updateActivities, type OrganizationCapabilities } from './api';
import { activityCopy, activityError } from './copy';
import './activities.css';

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
    return <section className="organization-activities" aria-labelledby={`activities-${id}`}>
        <h2 id={`activities-${id}`}>{copy.title}</h2>
        {loading ? <p role="status">{copy.loading}</p> : current && <form onSubmit={save}>
            <p>{copy.profile} · {copy.always}</p>
            <fieldset disabled={busy || needsReload || !current.canConfigureActivities}>
                <label><input type="checkbox" checked={venue} onChange={e => setVenue(e.target.checked)} />{copy.venue}</label>
                <label><input type="checkbox" checked={tournament} onChange={e => setTournament(e.target.checked)} />{copy.tournament}</label>
                <p>{copy.help}</p>
                {current.canConfigureActivities && <div className="organization-activity-actions"><button className="organization-primary" type="submit">{busy ? copy.saving : copy.save}</button></div>}
            </fieldset>
        </form>}
        {error && <><p role="alert">{error}</p><button type="button" disabled={busy} onClick={() => { setMessage(''); setReload(v => v + 1); }}>{copy.retry}</button></>}
        {message && <p role="status">{message}</p>}
    </section>;
}
