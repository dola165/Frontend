import { useEffect, useRef, useState } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { saveAbout } from '../api';

const LIMIT = 1000;

/**
 * "About me", written where it is read. Empty: one action that opens the box. Written: the text, with Edit. The box saves
 * when you leave it (and with Done), because nobody comes back to press Save; a failed save keeps the text.
 */
export function AboutInPlace({ bio, onSaved, open: startOpen = false, alwaysOpen = false }: {
    bio: string; onSaved?: (bio: string) => void; open?: boolean; alwaysOpen?: boolean;
}) {
    const copy = useJourneyCopy();
    const [editing, setEditing] = useState(startOpen || alwaysOpen);
    const [text, setText] = useState(bio);
    const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
    const [stored, setStored] = useState(bio);
    const box = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { if (editing && !alwaysOpen) box.current?.focus(); }, [editing, alwaysOpen]);
    const save = async (close: boolean) => {
        const next = text.trim();
        if (next === stored.trim()) { if (close && !alwaysOpen) setEditing(false); return; }
        setState('saving');
        try {
            await saveAbout(next);
            setStored(next); setState('saved'); onSaved?.(next);
            if (close && !alwaysOpen) setEditing(false);
        } catch { setState('failed'); }
    };
    if (!editing) return stored
        ? <div className="gk-about">
            <p className="gk-person-bio">{stored}</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><PenLine aria-hidden="true" />{copy('Edit', 'შეცვლა')}</Button>
        </div>
        : <div className="gk-about gk-about--empty">
            <p className="gk-faint">{copy('A few words about you and your football.', 'რამდენიმე სიტყვა თქვენზე და თქვენს ფეხბურთზე.')}</p>
            <Button size="sm" variant="primary" onClick={() => setEditing(true)}><PenLine aria-hidden="true" />{copy('Write about you', 'დაწერეთ თქვენ შესახებ')}</Button>
        </div>;
    return <div className="gk-about gk-about--open">
        <textarea ref={box} className="gk-input" rows={3} maxLength={LIMIT} value={text} aria-label={copy('About me', 'ჩემ შესახებ')}
            placeholder={copy('Your football and your work, in a few lines.', 'თქვენი ფეხბურთი და საქმე, რამდენიმე სიტყვით.')}
            onChange={event => { setText(event.target.value); if (state !== 'saving') setState('idle'); }} onBlur={() => void save(false)} />
        <div className="gk-about__foot">
            {state === 'saved' && <span role="status" className="gk-fp-saved">{copy('Saved', 'შენახულია')}</span>}
            {state === 'failed' && <span role="alert" className="gk-fp-error">{copy('Not saved. Your text is still here.', 'ვერ შეინახა. ტექსტი აქვეა.')}</span>}
            {!alwaysOpen && <Button size="sm" variant="primary" disabled={state === 'saving'} onMouseDown={event => event.preventDefault()} onClick={() => void save(true)}>{copy('Done', 'მზადაა')}</Button>}
        </div>
    </div>;
}
