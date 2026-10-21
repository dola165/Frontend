import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Panel, Section, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchDiscoveryPreferences, saveDiscoveryPreferences, type DiscoveryPreferences } from '../api';
import { useAccountCopy } from './accountCopy';
import './account-roles.css';

const OPTIONS = [
    ['WORK', 'Open to work', 'მზად ვარ სამუშაოსთვის'], ['SERVICES', 'Offer private sessions', 'კერძო სესიების შეთავაზება'],
    ['VOLUNTEER', 'Open to volunteering', 'მოხალისეობისთვის მზად ვარ'], ['CLUB', 'Looking for a club', 'კლუბს ვეძებ'],
    ['COACHING', 'Looking for a coach', 'მწვრთნელს ვეძებ'],
] as const;

/** Explicit public discovery facts; these preferences grant no club or booking access. */
export function DiscoveryPreferencesEditor() {
    const copy = useAccountCopy();
    const [data, setData] = useState<DiscoveryPreferences | null>(null);
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('GEL');
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const active = useRef(true);
    const pending = useRef<{ key: string; requestId: string } | null>(null);
    useEffect(() => {
        const controller = new AbortController(); active.current = true;
        setError(''); setData(null); setSaved(false);
        void fetchDiscoveryPreferences(controller.signal).then(value => {
            if (controller.signal.aborted) return;
            setData(value); setAmount(value.rate == null ? '' : String(value.rate.amount)); setCurrency(value.rate?.currency ?? 'GEL'); pending.current = null;
        }).catch(reason => { if (!controller.signal.aborted) setError(extractApiErrorMessage(reason, 'Preferences could not load.')); });
        return () => { controller.abort(); active.current = false; };
    }, [attempt]);
    const save = async (event: FormEvent) => {
        event.preventDefault(); if (!data || busy) return;
        setBusy(true); setError(''); setSaved(false);
        const value = { openTo: data.openTo, licence: data.licence, rate: data.openTo.includes('SERVICES') && amount !== '' ? { amount: Number(amount), currency, per: 'SESSION' as const } : null };
        const key = JSON.stringify({ value, version: data.version });
        if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() };
        try {
            const result = await saveDiscoveryPreferences(value, data.version, pending.current.requestId);
            if (active.current) { setData(result); pending.current = null; setSaved(true); }
        } catch (reason) {
            if (active.current) setError(extractApiErrorMessage(reason, 'Preferences could not be saved. Your changes are still here.'));
        } finally { if (active.current) setBusy(false); }
    };
    return <Section title={copy('Work and availability', 'სამუშაო და ხელმისაწვდომობა')}>
        {!data ? <Panel padded>{error ? <p role="alert">{copy(error)} <Button onClick={() => setAttempt(x => x + 1)}>{copy('Retry')}</Button></p> : <Skeleton height={100} />}</Panel> :
            <form onSubmit={save} className="gk-roles">
                <fieldset disabled={busy} className="gk-roles__fieldset">
                    <legend>{copy('What people can find you for', 'რისთვის შეუძლიათ თქვენი მოძებნა')}</legend>
                    <p className="gk-faint">{copy('Used on your published adult profile. These choices never give club access.', 'ჩანს გამოქვეყნებულ სრულწლოვნის პროფილზე. ეს არჩევანი კლუბის უფლებებს არ გაძლევთ.')}</p>
                    {OPTIONS.map(([value, en, ka]) => <label key={value} className="gk-role-details__toggle"><input type="checkbox" checked={data.openTo.includes(value)} onChange={event => {
                        setSaved(false); setData({ ...data, openTo: event.target.checked ? [...data.openTo, value] : data.openTo.filter(item => item !== value) });
                    }} />{copy(en, ka)}</label>)}
                    <Field label={copy('Coaching licence (self-reported)', 'სამწვრთნელო ლიცენზია (თქვენ მიერ მითითებული)')} htmlFor="discovery-licence">
                        <select id="discovery-licence" className="gk-input" value={data.licence ?? ''} onChange={event => { setSaved(false); setData({ ...data, licence: (event.target.value || null) as DiscoveryPreferences['licence'] }); }}>
                            <option value="">{copy('Not stated', 'არ არის მითითებული')}</option>
                            {['PRO', 'A', 'B', 'C', 'GK'].map(value => <option key={value} value={value}>{value === 'GK' ? copy('Goalkeeper licence', 'მეკარის მწვრთნელის ლიცენზია') : `UEFA ${value === 'PRO' ? 'Pro' : value}`}</option>)}
                        </select>
                    </Field>
                    {data.openTo.includes('SERVICES') && <div className="gk-role-details__fields">
                        <Field label={copy('Price per session (optional)', 'ერთი სესიის ფასი (არასავალდებულო)')} htmlFor="discovery-rate"><input id="discovery-rate" className="gk-input" type="number" min="0" step="0.01" max="9999999999.99" value={amount} onChange={event => { setSaved(false); setAmount(event.target.value); }} /></Field>
                        <Field label={copy('Currency', 'ვალუტა')} htmlFor="discovery-currency"><select id="discovery-currency" className="gk-input" value={currency} onChange={event => { setSaved(false); setCurrency(event.target.value); }}>{['GEL', 'USD', 'EUR', 'GBP'].map(value => <option key={value}>{value}</option>)}</select></Field>
                    </div>}
                </fieldset>
                {error && <div role="alert" className="gk-notice gk-notice--danger">{copy(error)} <Button size="sm" onClick={() => setAttempt(x => x + 1)}>{copy('Reload saved preferences', 'შენახული პარამეტრების თავიდან ჩატვირთვა')}</Button></div>}
                <div className="gk-roles__foot">{saved ? <span role="status">{copy('Saved.')}</span> : <span />}
                    <Button type="submit" variant="primary" disabled={busy}>{busy ? copy('Saving…') : copy('Save availability', 'ხელმისაწვდომობის შენახვა')}</Button>
                </div>
            </form>}
    </Section>;
}
