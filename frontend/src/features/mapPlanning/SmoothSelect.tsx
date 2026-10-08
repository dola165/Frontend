import { Children, isValidElement, useEffect, useId, useRef, useState, type CSSProperties, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './planning-polish.css';

/** Keeps native-select calling conventions while the list uses our map motion. */
export function SmoothSelect({ children, value, defaultValue, onChange, disabled, name, id, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const uid = useId(), button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState(String(defaultValue ?? ''));
  const options = Children.toArray(children).filter(isValidElement<{ value?: string | number; children: string; disabled?: boolean }>).map(child => ({ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled }));
  const selected = String(value ?? (local || options[0]?.value || ''));
  const [open, setOpen] = useState(false), [present, setPresent] = useState(false), [active, setActive] = useState(0), [position, setPosition] = useState<CSSProperties>({});
  const [menuLabel, setMenuLabel] = useState('Options');
  const typing = useRef({ text: '', at: 0 });
  const close = () => setOpen(false);
  const show = () => {
    if (!button.current || button.current.matches(':disabled')) return;
    const rect = button.current.getBoundingClientRect(), style = getComputedStyle(button.current);
    const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
    const up = below < Math.min(240, options.length * 42 + 12) && above > below;
    const width = Math.min(Math.max(rect.width, 210), window.innerWidth - 24);
    setPosition({ position: 'fixed', left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight: Math.min(320, up ? above : below), ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }), transformOrigin: up ? '50% 100%' : '50% 0%', '--mp-bg': style.getPropertyValue('--mp-bg'), '--mp-text': style.color, '--mp-line': style.getPropertyValue('--mp-line'), '--mp-green': style.getPropertyValue('--mp-green') } as CSSProperties & Record<string, string | number>);
    setMenuLabel(props['aria-label'] || button.current.labels?.[0]?.querySelector('span')?.textContent || 'Options');
    setActive(Math.max(0, options.findIndex(o => o.value === selected))); setPresent(true); setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index]; if (!option || option.disabled || button.current?.matches(':disabled')) return;
    setLocal(option.value); onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } } as unknown as React.ChangeEvent<HTMLSelectElement>); close(); button.current?.focus();
  };
  useEffect(() => { if (!open && present) { const timer = window.setTimeout(() => setPresent(false), 160); return () => clearTimeout(timer); } }, [open, present]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!button.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) close(); };
    const resize = () => close();
    document.addEventListener('pointerdown', outside, true); document.addEventListener('scroll', outside, true); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', outside, true); window.removeEventListener('resize', resize); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [active, open]);
  const move = (direction: number) => { for (let n = 1; n <= options.length; n++) { const index = (active + direction * n + options.length) % options.length; if (!options[index].disabled) { setActive(index); break; } } };
  return <><button type="button" ref={button} id={id} role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-invalid={props['aria-invalid']} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? uid : undefined} aria-activedescendant={open ? `${uid}-${active}` : undefined} disabled={disabled} className="mp-select-trigger" onClick={() => open ? close() : show()} onKeyDown={event => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); if (!open) show(); else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') move(event.key === 'ArrowDown' ? 1 : -1); else choose(active); }
    else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close();
    else if (open && (event.key === 'Home' || event.key === 'End')) { event.preventDefault(); const indices = options.map((_, i) => i).filter(i => !options[i].disabled); setActive(event.key === 'Home' ? indices[0] : indices.at(-1)!); }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); const now = event.timeStamp; typing.current = { text: (now - typing.current.at < 600 ? typing.current.text : '') + event.key.toLowerCase(), at: now }; const index = options.findIndex(o => !o.disabled && String(o.label).toLowerCase().startsWith(typing.current.text)); if (index >= 0) { if (open) setActive(index); else choose(index); } }
  }}><span>{options.find(o => o.value === selected)?.label || props.title || 'Choose an option'}</span><ChevronDown size={15}/></button>{name && <input type="hidden" name={name} value={selected} disabled={disabled}/>}
    {present && createPortal(<div ref={menu} id={uid} role={open ? 'listbox' : undefined} aria-label={menuLabel} aria-hidden={!open} className={`mp-select-menu ${open ? 'is-open' : 'is-closing'}`} style={position}>{options.map((option, index) => <div key={option.value} id={`${uid}-${index}`} role="option" aria-selected={option.value === selected} aria-disabled={option.disabled || undefined} data-index={index} className={`mp-select-option ${active === index ? 'is-highlighted' : ''}`} onPointerMove={() => !option.disabled && setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span>{option.value === selected && <Check size={15}/>}</div>)}</div>, document.body)}
  </>;
}
