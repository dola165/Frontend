import './combobox.css';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Search as SearchIcon } from 'lucide-react';

/**
 * A search box with suggestions (WAI-ARIA combobox, list autocomplete).
 * The caller owns the query and the results; arrow keys move, Enter picks, Escape closes.
 * `status` keeps loading, failure and "nothing found" distinct so the list never lies.
 * Pass `id` when a visible `Field` label points at the input; otherwise `label` is rendered for screen readers.
 */
export function Combobox<T>({ id, label, query, onQuery, items, itemKey, renderItem, onSelect, status, placeholder, emptyText, errorText, loadingText, minChars = 2, inputRef }: {
    id?: string; label: string; query: string; onQuery: (value: string) => void;
    items: T[]; itemKey: (item: T) => string | number; renderItem: (item: T) => ReactNode; onSelect: (item: T) => void;
    status: 'idle' | 'loading' | 'ready' | 'error'; placeholder?: string; emptyText?: string; errorText?: string; loadingText?: string; minChars?: number;
    inputRef?: React.Ref<HTMLInputElement>;
}) {
    const fallbackId = useId();
    const inputId = id ?? fallbackId;
    const listId = `${inputId}-list`;
    const [open, setOpen] = useState(false);
    // The highlighted option belongs to one result list; new results start unhighlighted.
    const [highlight, setHighlight] = useState<{ items: T[]; index: number }>({ items, index: -1 });
    const active = highlight.items === items ? highlight.index : -1;
    const setActive = (next: (current: number) => number) => setHighlight({ items, index: next(active) });
    const root = useRef<HTMLDivElement>(null);
    const searching = query.trim().length >= minChars;
    const showList = open && searching;

    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);

    const pick = (item: T) => { onSelect(item); setOpen(false); };
    const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            if (!items.length) return;
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            setActive(current => (current + delta + items.length) % items.length);
        } else if (event.key === 'Enter' && showList && active >= 0 && items[active]) {
            event.preventDefault();
            pick(items[active]);
        } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
        }
    };
    const optionId = (index: number) => `${inputId}-option-${index}`;
    const note = status === 'loading' ? (loadingText ?? 'Searching…') : status === 'error' ? (errorText ?? 'Search is unavailable. Try again.') : status === 'ready' && !items.length ? (emptyText ?? 'Nothing found.') : null;

    return (
        <div className="gk-combobox" ref={root}>
            {!id && <label className="gk-visually-hidden" htmlFor={inputId}>{label}</label>}
            <span className="gk-search">
                <SearchIcon aria-hidden="true" />
                <input id={inputId} ref={inputRef} className="gk-input" type="text" role="combobox" autoComplete="off" spellCheck={false}
                    aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
                    aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
                    value={query} placeholder={placeholder}
                    onChange={event => { onQuery(event.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)} onKeyDown={onKey} />
            </span>
            <div className="gk-combobox__popup" hidden={!showList}>
                <ul id={listId} role="listbox" aria-label={label} className="gk-combobox__list">
                    {items.map((item, index) => (
                        <li key={itemKey(item)} id={optionId(index)} role="option" aria-selected={index === active} className="gk-combobox__option"
                            onPointerDown={event => event.preventDefault()} onClick={() => pick(item)} onMouseMove={() => setActive(() => index)}>
                            {renderItem(item)}
                        </li>
                    ))}
                </ul>
                {note && <p className="gk-combobox__note" role="status">{note}</p>}
            </div>
        </div>
    );
}
