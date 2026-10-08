import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export type PanelWidths = { left: number; right: number; animated?: boolean };
const defaults = { left: 390, right: 280 };
const storageKey = 'grasskickz.mapPlanning.panels';
const fit = (value: PanelWidths): PanelWidths => {
  if (window.innerWidth < 1100) return value;
  const left = Math.min(value.left, window.innerWidth - Math.min(value.right, 460) - 320);
  return { left, right: Math.min(value.right, 460, window.innerWidth - left - 320) };
};
export function usePlanningPanels(onLayout: (widths: PanelWidths) => void) {
  const [widths, setWidths] = useState<PanelWidths>(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); return fit(saved && [saved.left, saved.right].every(n => Number.isFinite(n) && n >= 0 && n <= 600) ? saved : defaults); } catch { return defaults; }
  });
  const current = useRef(widths), frame = useRef(0);
  useEffect(() => { current.current = widths; onLayout(widths); try { localStorage.setItem(storageKey, JSON.stringify({left:widths.left,right:widths.right})); } catch { /* Optional preference. */ } }, [widths, onLayout]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const resize = () => setWidths(value => { const next = fit(value); return next.left === value.left && next.right === value.right ? value : next; });
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  const adjust = (side: 'left' | 'right', wanted: number) => {
    const other = current.current[side === 'left' ? 'right' : 'left'];
    const max = Math.max(220, Math.min(side === 'left' ? 600 : 460, window.innerWidth - other - 320));
    const next = { ...current.current, animated:false, [side]: wanted < 80 ? 0 : Math.max(side === 'left' ? 280 : 220, Math.min(max, wanted)) }; current.current = next; setWidths(next);
  };
  const animate = (side: 'left' | 'right', wanted: number) => {
    cancelAnimationFrame(frame.current);
    const other = current.current[side === 'left' ? 'right' : 'left'];
    const end = wanted ? Math.max(side === 'left' ? 280 : 220, Math.min(wanted, window.innerWidth - other - 320)) : 0;
    const next={...current.current,animated:true,[side]:end};current.current=next;setWidths(next);
  };
  const separator = (side: 'left' | 'right') => {
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      setWidths(value=>({...value,animated:false}));
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const bounds = event.currentTarget.closest('.mp-workspace')!.getBoundingClientRect();
      const next = side === 'left' ? event.clientX - bounds.left : bounds.right - event.clientX;
      cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => adjust(side, next));
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      animate(side, event.key === 'Home' ? 0 : event.key === 'End' ? defaults[side] : current.current[side] + (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 40 : -40));
    };
    return <div role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`Resize ${side === 'left' ? 'plan' : 'review'} panel`} aria-valuemin={0} aria-valuemax={side === 'left' ? 600 : 460} aria-valuenow={widths[side]} className={`mp-resizer mp-resizer--${side}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onDoubleClick={() => animate(side, widths[side] ? 0 : defaults[side])} onKeyDown={onKeyDown}><span /></div>;
  };
  return { widths, separator, toggle: (side: 'left' | 'right') => animate(side, current.current[side] ? 0 : defaults[side]) };
}
