import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { Button } from '../../../design/primitives';
import { refreshAccess } from '../../../hooks/useCan';
import { AddChild } from '../../parents/AddChild';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { joinTarget } from './joinTarget';
import '../actions.css';

/** Add my child over any page: the child's card, then Parent Hub with that child chosen. */
export function AddChildFlow({ onClose }: { onClose: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    return <Dialog open size="md" title={copy('Add my child', 'ჩემი შვილის დამატება')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        <AddChild inline onCreated={childId => { refreshAccess(); navigate(`/parent?player=${childId}`); }} />
    </Dialog>;
}

/**
 * Join with a code: paste the coach's link (from the parents' group) or type the code under its QR, and the join page
 * opens. From Parent Hub it carries the child, so the join page starts on "My child" with them chosen.
 */
export function JoinCodeFlow({ code = '', playerId, onClose }: { code?: string; playerId?: number; onClose: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const id = useId();
    const [value, setValue] = useState(code);
    const [error, setError] = useState('');
    const open = () => {
        const target = joinTarget(value);
        if (!target) { setError(copy('That isn’t a join link or code. Copy it again from the coach.', 'ეს არ არის შესვლის ბმული ან კოდი. ხელახლა დააკოპირეთ მწვრთნელისგან.')); return; }
        navigate(target.startsWith('/join/') && playerId ? `${target}?who=child&player=${playerId}` : target);
    };
    return <Dialog open size="sm" title={copy('Join with a code', 'გუნდში შესვლა კოდით')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        <form className="gk-join-code" onSubmit={event => { event.preventDefault(); open(); }}>
            <label className="gk-field__label" htmlFor={`${id}-code`}>{copy('The coach’s link or code', 'მწვრთნელის ბმული ან კოდი')}</label>
            <div className="gk-join-code__row">
                <input id={`${id}-code`} className="gk-input" autoFocus autoComplete="off" spellCheck={false} value={value} maxLength={300}
                    aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-error` : undefined}
                    onChange={event => { setValue(event.target.value); setError(''); }} placeholder="grasskickz.com/join/…" />
                <Button type="submit" variant="primary" disabled={!value.trim()}>{copy('Open', 'გახსნა')}<ArrowRight aria-hidden="true" /></Button>
            </div>
            {error && <p id={`${id}-error`} className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        </form>
    </Dialog>;
}
