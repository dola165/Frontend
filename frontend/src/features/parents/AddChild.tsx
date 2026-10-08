import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import './add-child.css';

type Intent = { fullName: string; dateOfBirth: string; responsible: boolean; requestId: string };
type Props = { onCreated: (childId: number) => void };

export function AddChild(props: Props) {
    const { user, sessionId } = useAuth();
    return <ChildForm key={`${user?.id}:${sessionId}`} {...props} />;
}

function ChildForm({ onCreated }: Props) {
    const { user, sessionId, refreshNavigationCapabilities } = useAuth();
    const copy = useJourneyCopy();
    const key = `new-child:${user?.id}:${sessionId}`;
    const [intent, setIntent] = useState<Intent | null>(() => {
        try {
            const value = JSON.parse(sessionStorage.getItem(key) || 'null');
            return value && typeof value.fullName === 'string' && typeof value.dateOfBirth === 'string'
                && value.responsible === true && typeof value.requestId === 'string' ? value : null;
        } catch { return null; }
    });
    const [open, setOpen] = useState(Boolean(intent));
    const [name, setName] = useState(intent?.fullName || '');
    const [dob, setDob] = useState(intent?.dateOfBirth || '');
    const [responsible, setResponsible] = useState(intent?.responsible || false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const saving = useRef(false);
    const nameInput = useRef<HTMLInputElement>(null);
    const toggle = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (open) nameInput.current?.focus(); }, [open]);

    async function save() {
        if (saving.current) return;
        const body = intent || { fullName: name.trim(), dateOfBirth: dob, responsible, requestId: crypto.randomUUID() };
        try { sessionStorage.setItem(key, JSON.stringify(body)); }
        catch {
            setError(copy('Allow session storage before saving, so a retry cannot create another profile.', 'ხელახლა ცდის უსაფრთხოებისთვის ჩართეთ სესიის საცავი.'));
            return;
        }
        saving.current = true;
        setBusy(true); setIntent(body); setError(''); setNotice('');
        try {
            const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
            const result = await apiClient.post<{ childId: number; name: string }>('/family/children', body, config);
            if (!isCurrentAuthSession(sessionId)) return;
            if (!Number.isSafeInteger(result.data.childId) || result.data.childId <= 0) throw new Error('Invalid save confirmation');
            sessionStorage.removeItem(key);
            setIntent(null); setName(''); setDob(''); setResponsible(false); setOpen(false);
            setNotice(copy('Child added. Their player card is selected below.', 'ბავშვი დაემატა. მისი ბარათი არჩეულია ქვემოთ.'));
            toggle.current?.focus();
            onCreated(result.data.childId);
            void refreshNavigationCapabilities().catch(() => {
                if (isCurrentAuthSession(sessionId)) setNotice(copy('Child added. Their profile is open below. Refresh the page to update your navigation shortcuts.', 'ბავშვი დაემატა. პროფილი გახსნილია ქვემოთ. ნავიგაციის განახლებისთვის განაახლეთ გვერდი.'));
            });
        } catch (e) {
            if (!isCurrentAuthSession(sessionId)) return;
            setError(extractApiErrorMessage(e, copy('Could not confirm the save. Retry the same request below.', 'შენახვა ვერ დადასტურდა. ხელახლა სცადეთ იგივე მოთხოვნა.')));
            if (isAxiosError(e) && [400, 403, 409, 429].includes(e.response?.status || 0)) {
                sessionStorage.removeItem(key); setIntent(null);
            }
        } finally { saving.current = false; setBusy(false); }
    }

    return <section className="parent-panel parent-add-child" aria-label={copy('Add a child', 'ბავშვის დამატება')}>
        <div className="parent-section-heading">
            <div><h2>{copy('Your family', 'თქვენი ოჯახი')}</h2><p>{copy('Create a private child card and reuse it for football arrangements.', 'შექმენით ბავშვის პირადი ბარათი და გამოიყენეთ ფეხბურთში მონაწილეობისთვის.')}</p></div>
            <button ref={toggle} className="parent-button parent-button-primary" type="button" aria-expanded={open} aria-controls="add-child-form" onClick={() => setOpen(!open)}><Plus size={16} />{copy('Add a child', 'ბავშვის დამატება')}</button>
        </div>
        {notice && <p role="status" className="family-notice">{notice}</p>}
        {open && <form id="add-child-form" onSubmit={e => { e.preventDefault(); void save(); }} aria-busy={busy}>
            <p className="parent-add-child-guidance"><ShieldCheck size={20} aria-hidden="true" /><span>{copy('Already has a profile? Ask their club or current guardian for an invitation. Create a new profile only for a child who is not registered yet.', 'უკვე აქვს პროფილი? სთხოვეთ კლუბს ან მეურვეს მოწვევა. ახალი პროფილი შექმენით მხოლოდ ჯერ დაურეგისტრირებელი ბავშვისთვის.')}</span></p>
            <div className="parent-add-child-fields">
                <label>{copy('Child’s full name', 'ბავშვის სრული სახელი')}<input ref={nameInput} autoComplete="off" required maxLength={150} value={name} disabled={Boolean(intent)} onChange={e => setName(e.target.value)} /></label>
                <label>{copy('Date of birth', 'დაბადების თარიღი')}<input type="date" required max={new Date().toISOString().slice(0, 10)} value={dob} disabled={Boolean(intent)} onChange={e => setDob(e.target.value)} /><small>{copy('For children under 18.', '18 წლამდე ბავშვებისთვის.')}</small></label>
            </div>
            <label className="parent-add-child-responsibility"><input type="checkbox" required checked={responsible} disabled={Boolean(intent)} onChange={e => setResponsible(e.target.checked)} /><span>{copy('I am this child’s parent or legal guardian and take responsibility for managing this private profile.', 'მე ვარ ამ ბავშვის მშობელი ან კანონიერი მეურვე და პასუხისმგებელი ვარ მისი პირადი პროფილის მართვაზე.')}</span></label>
            <p className="parent-add-child-privacy">{copy('Private to your family. No sign-in, club membership or participation consent is created.', 'ოჯახის პირადი პროფილი. არ იქმნება შესვლის უფლება, კლუბის წევრობა ან მონაწილეობის თანხმობა.')}</p>
            {error && <p role="alert" className="family-error">{error}</p>}
            {intent && <p>{copy('This request is saved for a safe retry. Keep the same details until the save is confirmed.', 'მოთხოვნა შენახულია უსაფრთხო ხელახალი ცდისთვის. დადასტურებამდე მონაცემები უცვლელი რჩება.')}</p>}
            <button className="parent-button parent-button-primary" disabled={busy}>{busy ? copy('Saving…', 'ინახება…') : intent ? copy('Retry save', 'ხელახლა შენახვა') : copy('Create child profile', 'ბავშვის პროფილის შექმნა')}</button>
        </form>}
    </section>;
}
