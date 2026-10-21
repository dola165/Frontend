import { useId, useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { SKILLS, type ChipOwner } from '../setupWords';
import type { FootballRole } from '../../roles/domain';
import { activeChips, ownerOf, type SetupDraft } from '../useSetupProfile';

const clean = (text: string) => text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

/** The choices of this draft that "What do you do?" offers words for. Parent and Fan have none. */
const skillOwners = (draft: SetupDraft): ChipOwner[] =>
    [...draft.roles, ...(draft.business ? ['BUSINESS' as const] : [])].filter(owner => Boolean(SKILLS[owner]));

/**
 * "What do you do?": what the person does, as chips. Tap a suggestion for the roles they chose, or type their own; as
 * they type, matching words are offered. Each chip is kept on the section of the role it belongs to.
 */
export function SkillPicker({ draft, onChange, main }: { draft: SetupDraft; onChange: (draft: SetupDraft) => void; main: FootballRole | null }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [query, setQuery] = useState('');
    const owners = skillOwners(draft);
    const chips = activeChips(draft);
    const picked = (text: string) => chips.some(chip => chip.text.toLowerCase() === text.toLowerCase());
    const words = (owner: ChipOwner) => (SKILLS[owner] ?? []).map(([en, ka]) => copy(en, ka));
    const suggestions = [...new Set(owners.flatMap(words))].filter(text => !picked(text));
    const everyWord = [...new Set([...owners, ...(Object.keys(SKILLS) as ChipOwner[])].flatMap(words))];
    const typed = clean(query).toLowerCase();
    const matches = typed ? everyWord.filter(text => text.toLowerCase().includes(typed) && !picked(text)).slice(0, 6) : [];

    const add = (text: string) => {
        const value = clean(text);
        setQuery('');
        if (!value || picked(value)) return;
        const owner = ownerOf(value, draft.roles, draft.business, main);
        if (owner) onChange({ ...draft, chips: [...draft.chips, { text: value, owner }] });
    };
    const remove = (text: string) => onChange({ ...draft, chips: draft.chips.filter(chip => chip.text !== text) });
    const key = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') { event.preventDefault(); add(matches.find(text => text.toLowerCase() === typed) ?? query); }
        else if (event.key === 'Backspace' && !query && chips.length) remove(chips[chips.length - 1].text);
    };
    if (!owners.length) return null;
    return <div className="gk-skills">
        <label className="gk-field__label" htmlFor={`${id}-input`}>{copy('What do you do?', 'რას აკეთებთ?')}</label>
        <div className="gk-skills__field">
            {chips.map(chip => <span key={chip.text} className="gk-skills__chip">{chip.text}
                <button type="button" aria-label={copy(`Remove ${chip.text}`, `${chip.text} — წაშლა`)} onClick={() => remove(chip.text)}><X aria-hidden="true" /></button>
            </span>)}
            <input id={`${id}-input`} className="gk-skills__input" value={query} maxLength={40} autoComplete="off"
                role="combobox" aria-expanded={matches.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
                placeholder={chips.length ? '' : copy('Type, or pick below', 'ჩაწერეთ ან აირჩიეთ ქვემოთ')}
                onChange={event => setQuery(event.target.value)} onKeyDown={key} />
        </div>
        {matches.length > 0 && <ul id={`${id}-list`} role="listbox" className="gk-skills__matches" aria-label={copy('Suggestions', 'შეთავაზებები')}>
            {matches.map(text => <li key={text} role="option" aria-selected={false} onMouseDown={event => { event.preventDefault(); add(text); }}>{text}</li>)}
        </ul>}
        {suggestions.length > 0 && <div className="gk-skills__suggestions" aria-label={copy('Suggestions', 'შეთავაზებები')}>
            {suggestions.map(text => <button key={text} type="button" className="gk-skills__suggestion" onClick={() => add(text)}><Plus aria-hidden="true" />{text}</button>)}
        </div>}
    </div>;
}
