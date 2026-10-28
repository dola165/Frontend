import { useId, useState, type KeyboardEvent } from 'react';
import { Phone } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { EditPencil } from '../../pages/edit/EditPencil';
import { phoneDisplay } from '../../pages/model/phone';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { saveMyPhone } from '../api';

/** A number someone can call: digits with an optional +, and spaces, dashes or brackets (the server checks it too). */
const callable = (typed: string) => { const digits = typed.replace(/\D/g, '').length; return /^\+?[\d\s()-]+$/.test(typed) && digits >= 6 && digits <= 15; };

/**
 * The phone colleagues may call (the owner, 28 October 2026), added, changed or removed on your own profile and edited
 * in place like a club page's Contact box: the same input and the same display. Only you see it here; fellow staff see
 * it in Club office › Staff unless you hide it there. Visitors never do, and only adults add one.
 */
export function PhoneInPlace({ phone, open = false, onSaved }: { phone: string | null; open?: boolean; onSaved: (phone: string | null) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [editing, setEditing] = useState(open);
    const [draft, setDraft] = useState(phone ?? '');
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const close = () => { setEditing(false); setDraft(phone ?? ''); setError(''); };
    const save = async (next: string) => {
        const typed = next.trim();
        if (typed === (phone ?? '')) { close(); return; }
        if (typed && !callable(typed)) { setError(copy('Enter a number colleagues can call, such as +995 555 12 34 56.', 'შეიყვანეთ ნომერი, რომელზეც კოლეგები დაგირეკავენ, მაგ. +995 555 12 34 56.')); return; }
        setSaving(true); setError('');
        try {
            const saved = (await saveMyPhone(typed)).phone ?? null;
            onSaved(saved); setDraft(saved ?? ''); setEditing(false);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('Not saved. Try again.', 'ვერ შეინახა. სცადეთ თავიდან.'))); }
        finally { setSaving(false); }
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); void save(draft); } if (event.key === 'Escape') close(); };
    return <SideBlock title={copy('Phone', 'ტელეფონი')} hint={copy('Colleagues see it in Staff', 'კოლეგები მას პერსონალში ხედავენ')}
        action={!editing && phone ? <EditPencil onClick={() => setEditing(true)} label={copy('Edit your phone', 'ტელეფონის შეცვლა')} /> : undefined}>
        <div id="phone" className="gk-person-phone">
            {editing ? <form className="gk-person-phone__form" onKeyDown={onKey} onSubmit={event => { event.preventDefault(); void save(draft); }}>
                <input id={`${id}-phone`} aria-label={copy('Phone', 'ტელეფონი')} className="gk-input" type="tel" inputMode="tel" autoComplete="tel" autoFocus value={draft} placeholder="+995 5__ __ __ __" maxLength={20}
                    aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} disabled={saving} onChange={event => { setDraft(event.target.value); setError(''); }} />
                {error && <p id={`${id}-error`} className="gk-fp-error" role="alert">{error}</p>}
                <div className="gk-person-phone__foot">
                    {phone && <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save('')}>{copy('Remove', 'წაშლა')}</Button>}
                    <Button size="sm" variant="ghost" disabled={saving} onClick={close}>{copy('Cancel', 'გაუქმება')}</Button>
                    <Button size="sm" variant="primary" disabled={saving} onClick={() => void save(draft)}>{saving ? copy('Saving…', 'ინახება…') : copy('Done', 'მზადაა')}</Button>
                </div>
            </form>
                : phone ? <p className="gk-person-phone__number"><Phone size={16} aria-hidden="true" />{phoneDisplay(phone)}</p>
                    : <Button size="sm" onClick={() => setEditing(true)}><Phone aria-hidden="true" />{copy('Add your phone', 'დაამატეთ ტელეფონი')}</Button>}
        </div>
    </SideBlock>;
}
