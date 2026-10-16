import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { usePagesCopy } from '../copy';
import { SETUP_ITEMS } from '../model/kinds';
import { usePageEdit } from './context';
import { STEP_ICONS, stepWhy, stepWords } from './words';
import './edit.css';


/** The ring filling up as the page is set up. */
export function SetupRing({ done, total, size = 28 }: { done: number; total: number; size?: number }) {
  const radius = 11, length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true" className="gk-ring__svg">
      <circle className="gk-ring__track" cx="14" cy="14" r={radius} />
      <circle className="gk-ring__fill" cx="14" cy="14" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - (total ? done / total : 0))} />
    </svg>
  );
}

/**
 * The set-up steps, dropped down from the bar: every step a tall row (its picture, its words, what it gives the
 * club), ticked when done, the next one lit; a tap opens the step where it is done and folds the list away (the ring
 * brings it back). A little transparent, so the
 * page stays visible under it. When a step gets done the list glows and the light moves on. Any order.
 */
export function SetupSteps({ onClose }: { onClose: () => void }) {
  const t = usePagesCopy();
  const { page, openStep } = usePageEdit();
  const [glow, setGlow] = useState(false);
  const done = page?.setup.done ?? 0;
  const previous = useRef(done);
  const id = useId();
  useEffect(() => {
    if (done <= previous.current) { previous.current = done; return; }
    previous.current = done;
    const on = window.setTimeout(() => setGlow(true), 0), off = window.setTimeout(() => setGlow(false), 1800);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [done]);
  if (!page) return null;
  const total = SETUP_ITEMS[page.kind].length, next = page.setup.next;
  return (
    <section className="gk-setup" data-glow={glow || undefined} aria-labelledby={`${id}-title`}>
      <header className="gk-setup__head">
        <h2 id={`${id}-title`} className="gk-setup__title">{t('Set-up steps')}</h2>
        <p className="gk-setup__count">{t('{done} of {total} done · any order', { done, total })}</p>
        <button type="button" className="gk-setup__toggle" onClick={onClose} aria-label={t('Hide the steps')}><X aria-hidden="true" /></button>
      </header>
      <ol className="gk-setup__list">
        {page.setup.items.map(item => {
          const Icon = STEP_ICONS[item.key];
          return (
            <li key={item.key}>
              <button type="button" className="gk-setup__step" data-done={item.done || undefined} data-next={item.key === next || undefined} onClick={() => { onClose(); openStep(item.key); }}>
                <span className="gk-setup__icon"><Icon aria-hidden="true" /></span>
                <span className="gk-setup__text"><span className="gk-setup__name">{t(stepWords(page.kind, item.key))}</span><span className="gk-setup__why">{t(stepWhy(page.kind, item.key))}</span></span>
                {item.done
                  ? <span className="gk-setup__state gk-setup__state--done"><Check aria-hidden="true" />{t('Done')}</span>
                  : item.key === next ? <span className="gk-setup__state gk-setup__state--next">{t('Next')}<ChevronRight aria-hidden="true" /></span>
                  : <span className="gk-setup__state"><ChevronRight aria-hidden="true" /></span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
