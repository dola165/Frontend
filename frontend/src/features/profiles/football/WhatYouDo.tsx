import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button, Field, Skeleton } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../../utils/apiError';
import {
    fetchDiscoveryPreferences, fetchOwnProfessions, professionSuggestions, saveDiscoveryPreferences, saveProfessions,
    type DiscoveryPreferences, type Profession, type ProfessionInput,
} from '../api';
import { VerificationBadge } from '../person/PersonLayers';
import { WORK_CHIPS, isChip } from '../workChips';

const MAX = 10;
/** Suggested chips shown before "more": enough to recognise yourself, few enough to read at a glance. */
const FEW = 5;
type OpenTo = DiscoveryPreferences['openTo'][number];
const LICENCES = ['C', 'B', 'A', 'PRO', 'GK'] as const;
const MORE: [OpenTo, string, string][] = [
    ['SERVICES', 'Offer private sessions', 'კერძო სესიების შეთავაზება'],
    ['CLUB', 'Looking for a club', 'კლუბს ვეძებ'],
    ['COACHING', 'Looking for a coach', 'მწვრთნელს ვეძებ'],
];
const input = (items: Profession[]): ProfessionInput[] => items.map(({ id, title, detail, since, published }) => ({ id, title, detail, since, published }));

/**
 * What you do: professions as chips in your own words, a licence, and who may find you. Every tap saves at once,
 * because nobody comes back to press Save. Nothing here grants anything in a club.
 */
export function WhatYouDo() {
    const copy = useJourneyCopy();
    const [professions, setProfessions] = useState<{ items: Profession[]; version: number } | null>(null);
    const [discovery, setDiscovery] = useState<DiscoveryPreferences | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [typing, setTyping] = useState('');
    const [open, setOpen] = useState<number | null>(null);
    const [allChips, setAllChips] = useState(false);
    const active = useRef(true);
    useEffect(() => {
        const controller = new AbortController();
        active.current = true;
        setFailed(false);
        void Promise.all([fetchOwnProfessions(controller.signal), fetchDiscoveryPreferences(controller.signal)])
            .then(([own, preferences]) => { if (!controller.signal.aborted) { setProfessions(own); setDiscovery(preferences); } })
            .catch(() => { if (!controller.signal.aborted) setFailed(true); });
        return () => { controller.abort(); active.current = false; };
    }, [attempt]);

    const run = async (work: () => Promise<void>) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await work(); }
        catch (reason) { if (active.current) setError(extractApiErrorMessage(reason, copy('That couldn’t be saved. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { if (active.current) setBusy(false); }
    };
    const writeProfessions = (next: ProfessionInput[]) => run(async () => {
        const saved = await saveProfessions(next, professions!.version, crypto.randomUUID());
        if (active.current) setProfessions(saved);
    });
    const writeDiscovery = (change: Partial<Omit<DiscoveryPreferences, 'version'>>) => run(async () => {
        const { openTo, licence, rate } = { ...discovery!, ...change };
        const saved = await saveDiscoveryPreferences({ openTo, licence, rate: openTo.includes('SERVICES') ? rate : null }, discovery!.version, crypto.randomUUID());
        if (active.current) setDiscovery(saved);
    });

    if (failed) return <div className="gk-fp-box"><p role="alert">{copy('What you do couldn’t load.', 'ვერ ჩაიტვირთა.')}</p><Button size="sm" onClick={() => setAttempt(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>;
    if (!professions || !discovery) return <div className="gk-fp-box" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={28} /><Skeleton height={28} width="70%" /></div>;

    const items = professions.items;
    const has = (title: string) => items.some(item => item.title.trim().toLowerCase() === title.trim().toLowerCase());
    const add = (title: string) => {
        const name = title.trim();
        if (!name || has(name) || items.length >= MAX) return;
        setTyping('');
        void writeProfessions([...input(items), { title: name, detail: null, since: null, published: items.every(item => item.published) }]);
    };
    const remove = (id: number) => { setOpen(null); void writeProfessions(input(items.filter(item => item.id !== id))); };
    const shown = items.length > 0 && items.every(item => item.published);
    const toggleOpen = (value: OpenTo, on: boolean) => writeDiscovery({ openTo: on ? [...discovery.openTo, value] : discovery.openTo.filter(item => item !== value) });
    const offered = WORK_CHIPS.filter(chip => !items.some(item => isChip(item.title, chip)));
    const editing = items.find(item => item.id === open) ?? null;

    return <div className="gk-fp-box gk-fp-work" aria-busy={busy}>
        <div className="gk-fp-chips" role="group" aria-label={copy('What you do', 'რას აკეთებთ')}>
            {items.map(item => <span key={item.id} className="gk-fp-chip" data-on="">
                <button type="button" className="gk-fp-chip__name" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}><Check aria-hidden="true" />{item.title}</button>
                <button type="button" className="gk-fp-chip__x" disabled={busy} aria-label={copy(`Remove ${item.title}`, `${item.title} — წაშლა`)} onClick={() => remove(item.id)}><X aria-hidden="true" /></button>
            </span>)}
            {items.length < MAX && offered.slice(0, allChips ? undefined : FEW).map(chip => <button key={chip.id} type="button" className="gk-fp-chip" disabled={busy} onClick={() => add(copy(chip.en, chip.ka))}><Plus aria-hidden="true" />{copy(chip.en, chip.ka)}</button>)}
            {items.length < MAX && !allChips && offered.length > FEW && <button type="button" className="gk-fp-chip gk-fp-chip--more" onClick={() => setAllChips(true)}>{copy(`${offered.length - FEW} more`, `კიდევ ${offered.length - FEW}`)}</button>}
        </div>
        {editing && <ProfessionDetails key={editing.id} item={editing} busy={busy} onSave={values => { setOpen(null); void writeProfessions(input(items).map(item => item.id === editing.id ? { ...item, ...values } : item)); }} />}
        {items.length < MAX && <form className="gk-fp-add" onSubmit={event => { event.preventDefault(); add(typing); }}>
            <input className="gk-input" list="gk-fp-suggestions" maxLength={80} value={typing} disabled={busy} onChange={event => setTyping(event.target.value)}
                placeholder={copy('Something else, in your words', 'სხვა რამ, თქვენი სიტყვებით')} aria-label={copy('Add what you do', 'დაამატეთ, რას აკეთებთ')} />
            <Button type="submit" size="sm" disabled={busy || !typing.trim()}>{copy('Add', 'დამატება')}</Button>
            <datalist id="gk-fp-suggestions">{professionSuggestions.map(title => <option key={title} value={title} />)}</datalist>
        </form>}

        <div className="gk-fp-licence" role="group" aria-label={copy('Coaching licence', 'სამწვრთნელო ლიცენზია')}>
            <span className="gk-faint">{copy('Licence', 'ლიცენზია')}</span>
            {LICENCES.map(value => <button key={value} type="button" className="gk-chip" aria-pressed={discovery.licence === value} disabled={busy}
                onClick={() => void writeDiscovery({ licence: discovery.licence === value ? null : value })}>{value === 'GK' ? copy('Goalkeeper', 'მეკარეთა') : `UEFA ${value === 'PRO' ? 'Pro' : value}`}</button>)}
        </div>

        <div className="gk-fp-switches">
            <Switch label={copy('Open to work', 'ღია ვარ სამსახურისთვის')} hint={copy('Clubs looking for help can find you.', 'კლუბები, რომლებსაც დახმარება სჭირდებათ, გიპოვიან.')} checked={discovery.openTo.includes('WORK')} disabled={busy} onChange={on => void toggleOpen('WORK', on)} />
            <Switch label={copy('Open to volunteering', 'მზად ვარ მოხალისეობისთვის')} checked={discovery.openTo.includes('VOLUNTEER')} disabled={busy} onChange={on => void toggleOpen('VOLUNTEER', on)} />
            <Switch label={copy('Show on my profile', 'ჩანდეს ჩემს პროფილზე')} hint={copy('What you do and your licence, for everyone.', 'რას აკეთებთ და ლიცენზია, ყველასთვის.')} checked={shown} disabled={busy || !items.length}
                onChange={on => void writeProfessions(input(items).map(item => ({ ...item, published: on })))} />
        </div>
        <details className="gk-fp-more">
            <summary>{copy('More ways to be found', 'სხვა გზები, რომ გიპოვონ')}</summary>
            {MORE.map(([value, en, ka]) => <Switch key={value} label={copy(en, ka)} checked={discovery.openTo.includes(value)} disabled={busy} onChange={on => void toggleOpen(value, on)} />)}
            {discovery.openTo.includes('SERVICES') && <RateField rate={discovery.rate} busy={busy} onSave={rate => void writeDiscovery({ rate })} />}
        </details>
        {error && <p role="alert" className="gk-fp-error">{error} <button type="button" className="gk-fp-link" onClick={() => setAttempt(value => value + 1)}>{copy('Reload', 'განახლება')}</button></p>}
    </div>;
}

function Switch({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
    return <label className="gk-fp-switch">
        <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
        <input type="checkbox" role="switch" className="gk-switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    </label>;
}

/** Since when and a few lines of experience for one profession, opened by tapping its chip. */
function ProfessionDetails({ item, busy, onSave }: { item: Profession; busy: boolean; onSave: (values: Pick<ProfessionInput, 'since' | 'detail'>) => void }) {
    const copy = useJourneyCopy();
    const [since, setSince] = useState(item.since ?? '');
    const [detail, setDetail] = useState(item.detail ?? '');
    return <form className="gk-fp-detail" aria-label={item.title} onSubmit={event => { event.preventDefault(); onSave({ since: since || null, detail: detail.trim() || null }); }}>
        <div className="gk-fp-detail__head"><strong>{item.title}</strong><VerificationBadge item={item} /></div>
        <Field label={copy('Since (year)', 'წლიდან')} htmlFor={`fp-since-${item.id}`}>
            <input id={`fp-since-${item.id}`} className="gk-input" inputMode="numeric" maxLength={4} value={since} onChange={event => setSince(event.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={copy('Experience', 'გამოცდილება')} htmlFor={`fp-detail-${item.id}`}>
            <textarea id={`fp-detail-${item.id}`} className="gk-input" rows={2} maxLength={600} value={detail} onChange={event => setDetail(event.target.value)} /></Field>
        <Button type="submit" size="sm" variant="primary" disabled={busy}>{copy('Done', 'მზადაა')}</Button>
    </form>;
}

function RateField({ rate, busy, onSave }: { rate: DiscoveryPreferences['rate']; busy: boolean; onSave: (rate: DiscoveryPreferences['rate']) => void }) {
    const copy = useJourneyCopy();
    const [amount, setAmount] = useState(rate ? String(rate.amount) : '');
    return <form className="gk-fp-add" onSubmit={event => { event.preventDefault(); onSave(amount === '' ? null : { amount: Number(amount), currency: rate?.currency ?? 'GEL', per: 'SESSION' }); }}>
        <input className="gk-input" type="number" min="0" step="1" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} aria-label={copy('Price per session, GEL', 'სესიის ფასი, ლარი')} placeholder={copy('Price per session, GEL', 'სესიის ფასი, ლარი')} />
        <Button type="submit" size="sm" disabled={busy}>{copy('Save', 'შენახვა')}</Button>
    </form>;
}
