import { useEffect, useRef, useState, type PointerEvent,type ReactNode } from 'react';
import { Grip, ShieldCheck, X } from 'lucide-react';
import { FamilyPlans } from './FamilyPlans';
import './planning-polish.css';

export function FamilyPlanWindow({ open, onClose, title='Family plans',children,className='' }: { open: boolean; onClose: () => void;title?:string;children?:ReactNode;className?:string }) {
  const windowRef = useRef<HTMLElement>(null), handle = useRef<HTMLButtonElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [present, setPresent] = useState(open), [position, setPosition] = useState({ left: 420, top: 80 });
  const clamp = (left: number, top: number) => {
    const node = windowRef.current, parent = node?.parentElement;
    const fixed = node && getComputedStyle(node).position==='fixed';
    return { left: Math.max(12, Math.min(left, (fixed?innerWidth:(parent?.clientWidth || innerWidth)) - (node?.offsetWidth || 520) - 12)), top: Math.max(70, Math.min(top, (fixed?innerHeight:(parent?.clientHeight || innerHeight)) - (node?.offsetHeight || 650) - 12)) };
  };
  useEffect(() => {
    if (open) { previousFocus.current = document.activeElement as HTMLElement; const frame = requestAnimationFrame(() => { setPresent(true); setPosition(p => clamp(p.left, p.top)); handle.current?.focus(); }); return () => cancelAnimationFrame(frame); }
    const timer = setTimeout(() => { setPresent(false); if (document.activeElement===document.body||windowRef.current?.contains(document.activeElement)) previousFocus.current?.focus(); }, 160); return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => { const resize = () => setPosition(p => clamp(p.left, p.top)); addEventListener('resize', resize); return () => removeEventListener('resize', resize); }, []);
  const down = (event: PointerEvent<HTMLButtonElement>) => { if (event.button !== 0 || innerWidth < 768) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ...position }; };
  if (!open && !present) return null;
  return <section ref={windowRef} role="dialog" aria-modal="false" aria-label={`${title} window`} aria-hidden={!open} inert={!open} className={`mp-family-popup ${className} ${open ? '' : 'is-closing'}`} style={position} onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header className="mp-family-window-header"><button ref={handle} type="button" className="mp-family-drag" aria-label={`Move ${title.toLowerCase()} window`} onPointerDown={down} onPointerMove={event => { if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) setPosition(clamp(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y)); }} onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => { const movement: Record<string, [number, number]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }; if (movement[event.key] && innerWidth >= 768) { event.preventDefault(); const [x, y] = movement[event.key]; setPosition(p => clamp(p.left + x, p.top + y)); } }}><Grip size={16}/><span>{title}<small>Drag to move · arrow keys work too</small></span></button><ShieldCheck size={17}/><button type="button" className="mp-icon" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={18}/></button></header>
    <div className="mp-family-window-content">{children||<FamilyPlans/>}</div>
  </section>;
}
