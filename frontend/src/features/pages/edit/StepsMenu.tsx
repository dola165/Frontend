import { useEffect, useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { usePagesCopy } from '../copy';
import type { PageView } from '../api';
import { SETUP_ITEMS } from '../model/kinds';
import { SETUP_PANEL, usePageEdit } from './context';
import { SETUP_WORDS } from './words';
import './edit.css';

/** One line under each step, what it gives the club: the guide, for whoever wants one. */
const WHY: Partial<Record<keyof typeof SETUP_WORDS, string>> = {
  name: 'How people find you', crest: 'Your badge everywhere', about: 'One or two lines visitors read first', grounds: 'Puts you on the map',
  squads: 'Makes the calendar and the join links', contact: 'Phone and WhatsApp for parents', fees: 'Shows in parents’ searches', players: 'One link per squad to share',
  staff: 'They act for the club', posts: 'What visitors see first', sponsors: 'Who you back',
};

/**
 * The ring with the steps behind it: hover or press, and every step of this page is listed, ticked when done, the
 * next one lit, each opening its editor. The guide for whoever wants one; any order for whoever does not.
 */
export function StepsMenu({ page }: { page: PageView }) {
  const t = usePagesCopy();
  const { openPanel } = usePageEdit();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const setup = page.setup, total = SETUP_ITEMS[page.kind].length, next = setup.next;
  const show = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { if (pinned) return; closeTimer.current = window.setTimeout(() => setOpen(false), 160); };
  const toggle = () => { const on = !(open && pinned); setPinned(on); setOpen(on); };
  // Escape and a tap outside close a pinned list.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setPinned(false); } };
    const onDown = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) { setOpen(false); setPinned(false); } };
    window.addEventListener('keydown', onKey); window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);
  const go = (key: keyof typeof SETUP_WORDS) => { setOpen(false); setPinned(false); openPanel(SETUP_PANEL[key]); };
  const radius = 11, length = 2 * Math.PI * radius;
  return (
    <div ref={root} className="gk-steps" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node)) hide(); }}>
      <button type="button" className="gk-ring" data-coach="ring" aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-list`} onClick={toggle}
        aria-label={next ? t('{done} of {total} done. Next: {next}', { done: setup.done, total, next: t(SETUP_WORDS[next]) }) : t('{done} of {total} done', { done: setup.done, total })}>
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <circle className="gk-ring__track" cx="14" cy="14" r={radius} />
          <circle className="gk-ring__fill" cx="14" cy="14" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - (total ? setup.done / total : 0))} />
        </svg>
        <span key={setup.done} className="gk-ring__count">{t('{done} of {total}', { done: setup.done, total })}</span>
        <span className="gk-ring__next">{t('Steps')}</span>
      </button>
      {open && (
        <ul id={`${id}-list`} className="gk-steps__list" role="menu" aria-label={t('Steps')}>
          {setup.items.map(item => (
            <li key={item.key} role="none">
              <button type="button" role="menuitem" className="gk-steps__item" data-done={item.done || undefined} data-next={item.key === next || undefined} onClick={() => go(item.key)}>
                <span className="gk-steps__mark" aria-hidden="true">{item.done ? <Check /> : null}</span>
                <span className="gk-steps__text"><span className="gk-steps__words">{t(SETUP_WORDS[item.key])}</span>{WHY[item.key] && <span className="gk-steps__why">{t(WHY[item.key]!)}</span>}</span>
                {item.key === next && <span className="gk-steps__next">{t('Next')}</span>}
                {item.done && <span className="gk-visually-hidden">{t('done')}</span>}
              </button>
            </li>
          ))}
          <li role="none" className="gk-steps__foot">{t('Any order. Tap a step to do it.')}</li>
        </ul>
      )}
    </div>
  );
}
