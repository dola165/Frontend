import { useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** A family's note as a sign on the player's card: a press shows it. */
export function CoachNote({ note }: { note: string }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    return <span className="pc-note">
        <button type="button" className="pc-sign pc-sign--injury" aria-expanded={open} aria-label={copy('A note from the family', 'ოჯახის შენიშვნა')} title={copy('A note from the family', 'ოჯახის შენიშვნა')}
            onClick={event => { event.stopPropagation(); setOpen(value => !value); }}><HeartPulse aria-hidden="true" /></button>
        {open && <span className="pc-note__text" role="note">{note}</span>}
    </span>;
}
