import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Flag, Sparkles } from 'lucide-react';
import { Crest } from '../../world/Crest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { savePublicRole, type FootballProfileData } from './api';

/**
 * What stands under your name everywhere: one of your real lines, picked for you until you choose another in this small
 * menu. Nothing can be typed.
 */
export function PublicLinePicker({ data, onSaved, onStale }: { data: FootballProfileData; onSaved: (data: FootballProfileData) => void; onStale: () => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const root = useRef<HTMLDivElement>(null);
    const shown = data.publicRole;
    useEffect(() => {
        if (!open) return;
        const away = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', away); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', escape); };
    }, [open]);
    const choose = async (id: string | null) => {
        setOpen(false);
        if (id !== null && id === shown?.id && shown.chosen) return;
        setBusy(true); setError('');
        try { onSaved(await savePublicRole(id, data.revision)); }
        catch (reason) {
            const stale = (reason as { response?: { status?: number } })?.response?.status === 409;
            setError(stale ? copy('This changed a moment ago. Look again and choose.', 'ეს ახლახან შეიცვალა. ხელახლა აირჩიეთ.') : extractApiErrorMessage(reason, copy('That couldn’t be saved. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.')));
            if (stale) onStale();
        }
        finally { setBusy(false); }
    };
    if (!shown) return <p className="gk-fp-under gk-faint">{copy('Under your name: nothing yet. It fills in when a club or squad adds you.', 'სახელის ქვეშ: ჯერ არაფერი. გამოჩნდება, როცა კლუბი ან გუნდი დაგამატებთ.')}</p>;
    const option = (id: string | null, label: string, mark: ReactNode, selected: boolean) => <li key={id ?? 'auto'} role="option" aria-selected={selected} tabIndex={0}
        onClick={() => void choose(id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void choose(id); } }}>
        {mark}<span>{label}</span>{selected && <Check aria-hidden="true" />}
    </li>;
    return <div className="gk-fp-under" ref={root}>
        <span className="gk-faint">{copy('Under your name', 'სახელის ქვეშ')}</span>
        {data.choices.length > 1
            ? <button type="button" className="gk-fp-under__button" aria-haspopup="listbox" aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)}>
                {shown.label}<ChevronDown aria-hidden="true" />
            </button>
            : <strong>{shown.label}</strong>}
        {open && <ul className="gk-fp-under__menu" role="listbox" aria-label={copy('Shown under your name', 'ჩანს სახელის ქვეშ')}>
            {data.choices.map(choice => option(choice.id, choice.label,
                choice.home ? <Crest src={choice.home.logoUrl} name={choice.home.name} size={24} /> : <span className="gk-fp-mark" style={{ width: 24, height: 24 }} aria-hidden="true"><Flag /></span>,
                choice.id === shown.id && shown.chosen))}
            {option(null, copy('Pick for me', 'ავტომატურად'), <span className="gk-fp-mark gk-fp-mark--auto" style={{ width: 24, height: 24 }} aria-hidden="true"><Sparkles /></span>, !shown.chosen)}
        </ul>}
        {error && <span role="alert" className="gk-fp-error">{error}</span>}
    </div>;
}
