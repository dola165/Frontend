import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Chip, EmptyNote, Field, Panel, Section, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchProfessions, professionSuggestions, saveProfessions, type Profession, type ProfessionInput } from '../api';
import { VerificationBadge } from '../person/PersonLayers';

type Draft = ProfessionInput & Partial<Pick<Profession, 'verification' | 'verifiedBy' | 'label'>> & { key: string };
const MAX = 10;
let nextKey = 0;
const draftOf = (item: Profession): Draft => ({ ...item, key: `saved-${item.id}` });
const thisYear = new Date().getFullYear();

/**
 * What you do professionally, in your own words ("Sports psychologist"), with experience and dates.
 * Clubs looking for help find people by it. Verification is set by a club or GrassKickZ, never here.
 */
export function ProfessionsEditor({ userId }: { userId: number }) {
    const [items, setItems] = useState<Draft[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [attempt, setAttempt] = useState(0);
    const [adding, setAdding] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const active = useRef(true);
    useEffect(() => {
        const controller = new AbortController();
        active.current = true;
        setState('loading');
        void fetchProfessions(userId, controller.signal)
            .then(list => { if (!controller.signal.aborted) { setItems(list.map(draftOf)); setState('ready'); } })
            .catch(reason => { if (!controller.signal.aborted) { setError(extractApiErrorMessage(reason, 'Your work and skills couldn’t load.')); setState('failed'); } });
        return () => { controller.abort(); active.current = false; };
    }, [userId, attempt]);

    const change = (key: string, values: Partial<Draft>) => { setSaved(false); setItems(current => current.map(item => item.key === key ? { ...item, ...values } : item)); };
    const add = (title: string) => {
        const name = title.trim();
        if (!name || items.length >= MAX || items.some(item => item.title.toLowerCase() === name.toLowerCase())) return;
        setSaved(false);
        setItems(current => [...current, { key: `new-${++nextKey}`, title: name, detail: null, since: null, published: true }]);
        setAdding('');
    };
    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (saving) return;
        if (items.some(item => !item.title.trim())) { setError('Give each profession a name, or remove it.'); return; }
        setSaving(true); setError(''); setSaved(false);
        try {
            const list = await saveProfessions(items.map(({ id, title, detail, since, published }) => ({ id, title: title.trim(), detail: detail?.trim() || null, since: since || null, published })));
            if (active.current) { setItems(list.map(draftOf)); setSaved(true); }
        } catch (reason) {
            if (active.current) setError(extractApiErrorMessage(reason, 'Your work and skills couldn’t be saved. Your changes are still here.'));
        } finally { if (active.current) setSaving(false); }
    };
    const suggestions = professionSuggestions.filter(title => !items.some(item => item.title.toLowerCase() === title.toLowerCase())).slice(0, 8);

    return <Section id="professions" title="Work and skills" hint="Your profession, in your own words">
        {state === 'loading' ? <Panel padded><div role="status" aria-label="Loading work and skills"><Skeleton height={96} /></div></Panel>
            : state === 'failed' ? <Panel><EmptyNote title="Your work and skills couldn’t load" action={<Button onClick={() => setAttempt(value => value + 1)}>Retry</Button>}><span role="alert">{error}</span></EmptyNote></Panel>
            : <form onSubmit={save} className="gk-roles">
                <fieldset disabled={saving} className="gk-roles__fieldset">
                    <legend className="gk-visually-hidden">Professions and skills</legend>
                    {items.map(item => <section key={item.key} className="gk-role-details" aria-label={`${item.title || 'New profession'} details`}>
                        <header className="gk-role-details__head">
                            <h3>{item.title || 'New profession'}</h3>
                            <div className="gk-role-details__toggles">
                                {item.verification && <VerificationBadge item={{ verification: item.verification, verifiedBy: item.verifiedBy ?? null }} />}
                                <label className="gk-role-details__toggle"><input type="checkbox" role="switch" className="gk-switch" checked={item.published} onChange={event => change(item.key, { published: event.target.checked })} />Show on my profile</label>
                                <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${item.title || 'this profession'}`} onClick={() => { setSaved(false); setItems(current => current.filter(other => other.key !== item.key)); }}><Trash2 aria-hidden="true" /></Button>
                            </div>
                        </header>
                        <div className="gk-role-details__fields">
                            <Field label="Profession" htmlFor={`${item.key}-title`} hint={item.verification === 'CLUB_CONFIRMED' ? 'Changing the name removes the club’s confirmation.' : undefined}>
                                <input id={`${item.key}-title`} className="gk-input" list="gk-profession-suggestions" maxLength={80} value={item.title} onChange={event => change(item.key, { title: event.target.value })} /></Field>
                            <Field label="Since (year)" htmlFor={`${item.key}-since`}>
                                <input id={`${item.key}-since`} className="gk-input" inputMode="numeric" pattern="\d{4}" placeholder={String(thisYear - 3)} maxLength={4} value={item.since ?? ''} onChange={event => change(item.key, { since: event.target.value.replace(/\D/g, '') || null })} /></Field>
                            <div className="gk-role-details__wide"><Field label="Experience" htmlFor={`${item.key}-detail`} hint="Where you work, who with, what you are qualified in. Like the about section of a CV.">
                                <textarea id={`${item.key}-detail`} className="gk-input" rows={3} maxLength={600} value={item.detail ?? ''} onChange={event => change(item.key, { detail: event.target.value })} /></Field></div>
                        </div>
                    </section>)}
                    {items.length < MAX ? <div className="gk-profession-add">
                        <Field label={items.length ? 'Add another profession' : 'Add your profession'} htmlFor="gk-profession-new" hint="Write it the way you would say it. We match it to the directory for you.">
                            <div className="gk-row"><input id="gk-profession-new" className="gk-input" list="gk-profession-suggestions" maxLength={80} placeholder="For example: sports psychologist" value={adding}
                                onChange={event => setAdding(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(adding); } }} />
                                <Button disabled={!adding.trim()} onClick={() => add(adding)}><Plus aria-hidden="true" />Add</Button></div>
                        </Field>
                        {suggestions.length > 0 && <div className="gk-chips" role="group" aria-label="Suggestions">{suggestions.map(title => <Chip key={title} onClick={() => add(title)}><Plus aria-hidden="true" />{title}</Chip>)}</div>}
                    </div> : <p className="gk-faint">You can list up to {MAX} professions.</p>}
                    <datalist id="gk-profession-suggestions">{professionSuggestions.map(title => <option key={title} value={title} />)}</datalist>
                </fieldset>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
                <div className="gk-roles__foot">
                    <p className="gk-faint">Shown as self-reported until a club or GrassKickZ confirms it. Clubs can find you for jobs and volunteering in the People directory.</p>
                    <div className="gk-row">
                        {saved && <span role="status" className="gk-roles__saved">Saved.</span>}
                        <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save work and skills'}</Button>
                    </div>
                </div>
            </form>}
    </Section>;
}
