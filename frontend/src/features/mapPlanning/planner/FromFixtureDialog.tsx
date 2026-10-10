import { useEffect, useId, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { Dialog } from '../../../design/Dialog';
import { Button, Field } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { Plan } from '../api';
import './planner.css';

interface Preferences {
    template: string; mode: string; meetingPoint: string; latitude: number | null; longitude: number | null; travelMinutes: number | null;
    arrivalMinutes: number; loadingMinutes: number; recoveryMinutes: number; transportMinor: number; mealPerPlayerMinor: number; budgetMinor: number; supervisionContact: string;
}
const DEFAULTS: Preferences = { template: 'AWAY_MATCH', mode: 'TRAVEL_TOGETHER', meetingPoint: '', latitude: null, longitude: null, travelMinutes: null, arrivalMinutes: 45, loadingMinutes: 10, recoveryMinutes: 20, transportMinor: 0, mealPerPlayerMinor: 0, budgetMinor: 0, supervisionContact: '' };
const TEMPLATE_TIMES: Record<string, { arrivalMinutes: number; recoveryMinutes: number }> = { AWAY_MATCH: { arrivalMinutes: 45, recoveryMinutes: 20 }, TRAINING_DAY: { arrivalMinutes: 30, recoveryMinutes: 15 }, TOURNAMENT_DAY: { arrivalMinutes: 60, recoveryMinutes: 30 } };
export interface FixtureChoice { squadId: number; clubId: number; name: string }

function NumberField({ label, value, onChange, min = 0, max, step, hint }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number; max?: number; step?: string; hint?: string }) {
    const id = useId();
    return <Field label={label} htmlFor={id} hint={hint}><input id={id} className="gk-input" type="number" min={min} max={max} step={step} value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))} /></Field>;
}

/**
 * Starts a journey from an agreed fixture: the meeting point, travel and buffers the
 * squad usually uses, then the drafted stops open on the map. Reopening returns to the
 * fixture's existing draft.
 */
export function FromFixtureDialog({ eventId, title, choices, onClose, onCreated }: {
    eventId: number; title: string; choices: FixtureChoice[]; onClose: () => void; onCreated: (plan: Plan, choice: FixtureChoice) => void;
}) {
    const [squad, setSquad] = useState(choices[0]?.squadId ?? 0);
    const choice = choices.find(item => item.squadId === squad) ?? choices[0];
    const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
    const [revision, setRevision] = useState(0);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const squadId = useId(), meetId = useId(), contactId = useId();
    useEffect(() => {
        if (!choice) return;
        const controller = new AbortController();
        void apiClient.get<{ revision: number; preferences: Partial<Preferences> }>(`/journeys/squads/${choice.squadId}/preferences`, { signal: controller.signal })
            .then(response => { setPrefs({ ...DEFAULTS, ...response.data.preferences }); setRevision(response.data.revision); setError(''); })
            .catch(cause => { if (!controller.signal.aborted) setError(extractApiErrorMessage(cause, 'This squad’s usual travel settings could not load. You can still continue.')); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [choice]);
    const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPrefs(current => ({ ...current, [key]: value }));
    const together = prefs.mode === 'TRAVEL_TOGETHER';
    const ready = !together || (prefs.meetingPoint.trim() && prefs.travelMinutes);
    const start = async () => {
        if (!choice || busy || !ready) return;
        setBusy(true); setError('');
        try {
            if (remember) await apiClient.put(`/journeys/squads/${choice.squadId}/preferences`, { revision, preferences: prefs });
            const { data } = await apiClient.post<Plan>('/journeys/from-fixture', { eventId, clubId: choice.clubId, squadId: choice.squadId, preferences: prefs }, { timeout: 25000 });
            onCreated(data, choice);
        } catch (cause) {
            setError(extractApiErrorMessage(cause, 'The journey could not be drafted. Try again; this fixture reuses its existing draft.'));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Dialog open title="Plan the journey" description={title} onClose={() => { if (!busy) onClose(); }}
            footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void start()} disabled={busy || loading || !ready}>{busy ? 'Drafting the stops…' : 'Draft the journey'}</Button></>}>
            {choices.length > 1 && (
                <Field label="Squad" htmlFor={squadId}>
                    <select id={squadId} className="gk-input" value={squad} onChange={event => { setSquad(Number(event.target.value)); setLoading(true); }}>
                        {choices.map(item => <option key={item.squadId} value={item.squadId}>{item.name}</option>)}
                    </select>
                </Field>
            )}
            <div className="gk-field">
                <span className="gk-field__label">Kind of day</span>
                <Segmented label="Kind of day" value={prefs.template} onChange={value => setPrefs(current => ({ ...current, template: value, ...TEMPLATE_TIMES[value] }))}
                    items={[{ id: 'AWAY_MATCH', label: 'Away match' }, { id: 'TOURNAMENT_DAY', label: 'Tournament' }, { id: 'TRAINING_DAY', label: 'Training day' }]} />
            </div>
            <div className="gk-field">
                <span className="gk-field__label">How the team gets there</span>
                <Segmented label="How the team gets there" value={prefs.mode} onChange={value => set('mode', value)}
                    items={[{ id: 'TRAVEL_TOGETHER', label: 'Meet and travel together' }, { id: 'MEET_AT_VENUE', label: 'Meet at the venue' }]} />
            </div>
            {together && (
                <div className="gk-plan-grid">
                    <Field label="Meeting point" htmlFor={meetId} hint="You can pin it on the map afterwards.">
                        <input id={meetId} className="gk-input" required maxLength={400} value={prefs.meetingPoint} placeholder="Academy entrance, Gate 2" onChange={event => set('meetingPoint', event.target.value)} />
                    </Field>
                    <NumberField label="Travel each way (minutes)" value={prefs.travelMinutes} min={1} max={1440} onChange={value => set('travelMinutes', value)} hint="Your own estimate" />
                </div>
            )}
            <NumberField label="Arrive before kick-off (minutes)" value={prefs.arrivalMinutes} max={240} onChange={value => set('arrivalMinutes', value ?? 0)} />
            <details className="gk-plan-more">
                <summary>More options</summary>
                <div className="gk-plan-grid">
                    <NumberField label="Gathering buffer (minutes)" value={prefs.loadingMinutes} max={120} onChange={value => set('loadingMinutes', value ?? 0)} />
                    <NumberField label="After the match (minutes)" value={prefs.recoveryMinutes} max={240} onChange={value => set('recoveryMinutes', value ?? 0)} />
                    <NumberField label="Transport estimate" value={prefs.transportMinor / 100} step="0.01" onChange={value => set('transportMinor', Math.round((value ?? 0) * 100))} />
                    <NumberField label="Meal per player" value={prefs.mealPerPlayerMinor / 100} step="0.01" onChange={value => set('mealPerPlayerMinor', Math.round((value ?? 0) * 100))} />
                    <NumberField label="Budget limit" value={prefs.budgetMinor / 100} step="0.01" onChange={value => set('budgetMinor', Math.round((value ?? 0) * 100))} />
                    <Field label="Supervision contact" htmlFor={contactId}><input id={contactId} className="gk-input" maxLength={400} value={prefs.supervisionContact} onChange={event => set('supervisionContact', event.target.value)} /></Field>
                </div>
            </details>
            <label className="gk-plan-check"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Use these settings next time for this squad</label>
            {error && <div className="gk-notice gk-notice--warning" role="alert">{error}</div>}
            <p className="gk-faint">The plan stays private until you publish it. Costs are estimates; bookings and approvals stay separate.</p>
        </Dialog>
    );
}
