import { useId, useRef, useState } from 'react';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import type { Person } from './types';
import { mentionPattern } from './mentionWords';
import './work.css';

/** A comment box where "@" offers the team's names; arrows choose, Enter or Tab puts the name in. */
export function MentionInput({ id, value, team, rows = 2, placeholder, label, onChange }: {
    id?: string; value: string; team: Person[]; rows?: number; placeholder?: string; label?: string; onChange: (value: string) => void;
}) {
    const copy = useJourneyCopy();
    const box = useRef<HTMLTextAreaElement>(null);
    const listId = useId();
    const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
    const [active, setActive] = useState(0);
    const matches = query ? team.filter(person => person.name?.toLowerCase().startsWith(query.text.toLowerCase())).slice(0, 6) : [];
    const write = (next: string, caret: number) => {
        onChange(next);
        const typed = next.slice(0, caret).match(/(^|\s)@([^\s@]*)$/);
        setQuery(typed ? { start: caret - typed[2].length - 1, text: typed[2] } : null);
        setActive(0);
    };
    const pick = (person: Person) => {
        if (!query || !person.name) return;
        const caret = box.current?.selectionStart ?? value.length;
        const at = query.start + person.name.length + 2;
        onChange(`${value.slice(0, query.start)}@${person.name} ${value.slice(caret)}`);
        setQuery(null);
        requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(at, at); });
    };
    return <div className="work-mention">
        <textarea ref={box} id={id} className="gk-input" rows={rows} maxLength={2000} value={value} placeholder={placeholder} aria-label={label}
            role="combobox" aria-autocomplete="list" aria-expanded={matches.length > 0} aria-controls={listId}
            aria-activedescendant={matches.length ? `${listId}-${active}` : undefined}
            onChange={event => write(event.target.value, event.target.selectionStart)}
            onKeyDown={event => {
                if (!matches.length) return;
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(current => (current + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length); }
                else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); pick(matches[active]); }
                else if (event.key === 'Escape') setQuery(null);
            }}
            onBlur={() => setQuery(null)} />
        {matches.length > 0 && <ul id={listId} role="listbox" className="work-mention__list" aria-label={copy('Tag someone', 'მონიშნეთ ვინმე')}>
            {matches.map((person, index) => <li key={person.id ?? person.name} id={`${listId}-${index}`} role="option" aria-selected={index === active}
                onMouseDown={event => { event.preventDefault(); pick(person); }}>@{person.name}</li>)}
        </ul>}
    </div>;
}

/** A comment with its tags picked out; a tag for the person reading it stands out. */
export function MentionText({ text, team, me }: { text: string; team: Person[]; me?: number | null }) {
    const pattern = mentionPattern(team);
    if (!pattern) return <>{text}</>;
    return <>{text.split(pattern).map((step, index) => index % 2 === 0 ? step
        : <span key={index} className="tw-tag" data-me={team.find(person => person.name === step)?.id === me || undefined}>@{step}</span>)}</>;
}
