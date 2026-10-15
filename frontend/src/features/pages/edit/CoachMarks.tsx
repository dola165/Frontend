import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import type { PageRef } from '../api';
import './edit.css';

/** The three things a new owner must see, each pointed at on the page itself: the ring, a box, Go live. */
const STEPS: { target: string; words: string; hint: string }[] = [
  { target: '[data-coach="ring"]', words: 'This ring is your to-do list.', hint: 'Tap it: it opens the next thing.' },
  // The box the ring points at; when the next thing is not a box (the crest), any empty box will do.
  { target: '[data-coach="next-box"], .gk-boxframe:has(.gk-ghost)', words: 'Tap a box to fill it.', hint: 'Green says “needed to go live”. The rest can wait.' },
  { target: '[data-coach="live"]', words: 'Go live when the ring lets you.', hint: 'Until then only you see this page.' },
];
const seenKey = (ref: PageRef) => `gk-page-coach:${ref.type}-${ref.id}`;
const read = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const write = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* a private window forgets; the marks show again */ } };

/**
 * A short walkthrough the first time someone lands on their new page: one small bubble at a time, anchored to the
 * real control (`data-coach="…"`), Next / Got it, Escape to leave. Shown once per page, never for a claimed page
 * (its owner already knows the club) and never again after Got it.
 */
export function CoachMarks({ pageRef }: { pageRef: PageRef }) {
  const t = usePagesCopy();
  const key = seenKey(pageRef);
  const [step, setStep] = useState(() => (read(key) ? -1 : 0));
  const bubble = useRef<HTMLDivElement>(null);
  const current = step >= 0 ? STEPS[step] : null;
  const finish = () => { write(key); setStep(-1); };
  const next = () => (step + 1 < STEPS.length ? setStep(step + 1) : finish());

  // The bubble follows its target: measured after each paint, again on scroll and resize. A step whose target is not on the page is skipped.
  useEffect(() => {
    if (!current) return;
    if (!document.querySelector(current.target)) { const skip = window.setTimeout(() => setStep(value => (value + 1 < STEPS.length ? value + 1 : -1)), 0); return () => clearTimeout(skip); }
    const place = () => {
      const target = document.querySelector<HTMLElement>(current.target), box = bubble.current;
      if (!box) return;
      if (!target) { box.style.visibility = 'hidden'; return; }
      const rect = target.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
      box.style.width = `${width}px`; box.style.left = `${left}px`; box.style.top = `${rect.bottom + 10}px`; box.style.visibility = 'visible';
      box.style.setProperty('--gk-coach-arrow', `${Math.max(16, Math.min(rect.left + rect.width / 2 - left, width - 16))}px`);
      target.setAttribute('data-coach-on', '');
      if (rect.top < 0 || rect.bottom > window.innerHeight) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    place();
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); window.removeEventListener('keydown', onKey);
      document.querySelectorAll('[data-coach-on]').forEach(node => node.removeAttribute('data-coach-on'));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only writes storage and clears the step
  }, [current]);

  if (!current) return null;
  // Inside the page's own design root, so the bubble has the tokens and the theme; fixed positioning does the rest.
  const host = document.querySelector<HTMLElement>('.gk') ?? document.body;
  return createPortal(
    <div ref={bubble} className="gk-coach" role="dialog" aria-label={t(current.words)} data-step={step}>
      <p className="gk-coach__words">{t(current.words)}</p>
      <p className="gk-coach__hint">{t(current.hint)}</p>
      <div className="gk-coach__foot">
        <span className="gk-coach__dots" aria-hidden="true">{STEPS.map((_, index) => <i key={index} data-on={index <= step || undefined} />)}</span>
        {step + 1 < STEPS.length && <Button size="sm" variant="ghost" onClick={finish}>{t('Skip')}</Button>}
        <Button size="sm" variant="primary" onClick={next}>{t(step + 1 < STEPS.length ? 'Next' : 'Got it')}</Button>
      </div>
    </div>,
    host,
  );
}
