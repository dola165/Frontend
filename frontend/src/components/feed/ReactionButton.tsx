import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ThumbsUp } from 'lucide-react';
import { REACTIONS, type Reaction } from './reactions';
import './reactions.css';

export function ReactionButton({ value, onChange, disabled = false, allowAll = true, count }: { value: Reaction | null; onChange: (reaction: Reaction | null) => void; disabled?: boolean; allowAll?: boolean; count?: number }) {
    const [open, setOpen] = useState(false), id = useId();
    const root = useRef<HTMLDivElement>(null), primary = useRef<HTMLButtonElement>(null), picker = useRef<HTMLDivElement>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null), holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null), held = useRef(false);
    const selected = REACTIONS.find(reaction => reaction.type === value);
    const countLabel = count == null ? null : `${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(count)} ${count === 1 ? 'reaction' : 'reactions'}`;
    const cancelHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
    const close = (focus = false) => { setOpen(false); if (focus) primary.current?.focus(); };
    const choose = (reaction: Reaction) => { close(true); onChange(reaction === value ? null : reaction); };
    useEffect(() => {
        const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
        if (open) document.addEventListener('pointerdown', dismiss);
        return () => document.removeEventListener('pointerdown', dismiss);
    }, [open]);
    useEffect(() => () => { cancelHold(); if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
    const focusOption = (index: number) => requestAnimationFrame(() => picker.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus());
    const keyboard = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); focusOption(Math.max(0, REACTIONS.findIndex(r => r.type === value))); }
    };
    return <div ref={root} className="post-reaction-control" onKeyDown={keyboard}
        onPointerEnter={event => { if (event.pointerType === 'mouse' && !disabled && allowAll) { if (hoverTimer.current) clearTimeout(hoverTimer.current); setOpen(true); } }}
        onPointerLeave={() => { cancelHold(); if (!root.current?.contains(document.activeElement)) hoverTimer.current = setTimeout(() => setOpen(false), 350); }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
        <button ref={primary} type="button" className="post-action post-reaction-primary" data-reaction={value ?? undefined} aria-label={countLabel ? `${selected?.label ?? 'Like'}, ${countLabel}` : selected?.label ?? 'Like'} aria-pressed={Boolean(value)} disabled={disabled}
            onPointerDown={event => { held.current = false; if (event.pointerType === 'touch' && allowAll && !disabled) holdTimer.current = setTimeout(() => { held.current = true; setOpen(true); }, 450); }}
            onPointerUp={cancelHold} onPointerCancel={cancelHold} onContextMenu={event => { if (held.current) event.preventDefault(); }}
            onClick={() => { if (held.current) { held.current = false; return; } close(); onChange(value ? null : 'LIKE'); }}>
            {selected ? <span aria-hidden="true" className="post-reaction-emoji">{selected.emoji}</span> : <ThumbsUp size={18} aria-hidden="true" />}<span>{countLabel ?? selected?.label ?? 'Like'}</span>
        </button>
        {allowAll && <button type="button" className="post-reaction-expand" aria-label="Choose a reaction" aria-expanded={open} aria-controls={id} disabled={disabled}
            onClick={() => { setOpen(true); focusOption(Math.max(0, REACTIONS.findIndex(r => r.type === value))); }}><ChevronDown size={14} aria-hidden="true" /></button>}
        {open && allowAll && <div ref={picker} id={id} role="toolbar" aria-label="Post reactions" className="post-reaction-picker" onKeyDown={event => {
            const options = Array.from(picker.current?.querySelectorAll<HTMLButtonElement>('button') ?? []), index = options.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'ArrowRight' ? (index + 1) % options.length : event.key === 'ArrowLeft' ? (index + options.length - 1) % options.length : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
            if (next !== null) { event.preventDefault(); event.stopPropagation(); options[next]?.focus(); }
        }}>{REACTIONS.map(reaction => <button key={reaction.type} type="button" title={reaction.label} aria-label={reaction.label} aria-pressed={value === reaction.type} disabled={disabled} onClick={() => choose(reaction.type)}><span aria-hidden="true">{reaction.emoji}</span><span className="post-reaction-tip">{reaction.label}</span></button>)}</div>}
    </div>;
}
