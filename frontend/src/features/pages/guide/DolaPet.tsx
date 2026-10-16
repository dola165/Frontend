import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from '../../world/useMediaQuery';
import { usePagesCopy } from '../copy';
import type { SetupKey } from '../model/kinds';
import { usePageEdit } from '../edit/context';
import { usePhoneSteps } from '../edit/usePhoneSteps';
import { askPet, type PetAnswer } from './api';
import { PetSprite, type PetFrame } from './PetSprite';
import './pet.css';

/** What Dola says at each step of a club's set-up: one short sentence, no model. */
const LINES: Record<string, string> = {
  name: 'Start with your club’s name. Tap here and type it.',
  crest: 'Your crest goes here. Upload one or pick two colours.',
  about: 'Say in one line who you are.',
  grounds: 'Where do you play? Pick your pitch on the map.',
  squads: 'Which teams do you have? Choose the birth years.',
  contact: 'How do parents reach you? Your phone is almost filled in.',
  fees: 'What does it cost? Slide the price, or tick Free.',
  players: 'Now share a join link, so parents add their children.',
  ready: 'All set! Tap Go live when you are ready.',
  waiting: 'Almost there. Add a ground or a way to reach you, then go live.',
};
/** Where each step is done on the page. */
const TARGETS: Record<string, string> = {
  name: '[data-step="name"]', crest: '[data-step="crest"]', about: '[data-step="about"]', grounds: '[data-box="grounds"]', squads: '[data-box="squads"]',
  contact: '[data-box="contact"]', fees: '[data-box="fees"]', players: '[data-box="squads"]', ready: '[data-coach="live"]', waiting: '[data-coach="live"]',
};
const EXAMPLES = ['Where do I add my ground?', 'What’s a birth year?'];
const W = 60, H = 68, GAP = 6, EDGE = 8;
const HIDDEN = 'gk-pet-hidden';
const readHidden = () => { try { return localStorage.getItem(HIDDEN) === '1'; } catch { return false; } };
const keepHidden = (value: boolean) => { try { localStorage.setItem(HIDDEN, value ? '1' : '0'); } catch { /* a private window: hidden for this visit */ } };

interface Spot { x: number; y: number }
/** Beside the target if there is room (left first, then right), else under it; always inside the window. */
function spotFor(rect: DOMRect, under = false): Spot {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - H - EDGE);
  const middle = rect.top + Math.min(rect.height, 120) / 2 - H / 2;
  if (!under && rect.left >= W + GAP + EDGE) return { x: rect.left - W - GAP, y: clampY(middle) };
  if (!under && rect.right + W + GAP + EDGE <= vw) return { x: rect.right + GAP, y: clampY(middle) };
  const below = rect.bottom + GAP + H + EDGE <= vh;
  return { x: Math.min(Math.max(rect.left + 12, EDGE), vw - W - EDGE), y: clampY(below ? rect.bottom + GAP : rect.top - H - GAP) };
}

/**
 * Agent Dola as a pet on a club's draft (a prototype beside the set-up steps): she walks to the current step's box,
 * points at it and says one sentence; when the step is done she walks on. A tap asks her a question (the sandbox's
 * pet guide: Jev picks the step, DeepSeek words the answer) and she walks to that step. She only guides, never acts.
 */
export function DolaPet() {
  const t = usePagesCopy();
  const { page, panel } = usePageEdit();
  const phone = usePhoneSteps();
  const still = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [hidden, setHidden] = useState(readHidden);
  const [asking, setAsking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<(PetAnswer & { forNext: SetupKey | null; forCard: string | null }) | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [facing, setFacing] = useState<'right' | 'left'>('right');
  const [walking, setWalking] = useState(false);
  const [tick, setTick] = useState(false);
  const last = useRef<Spot | null>(null);

  const next = page?.setup.next ?? null;
  // An answer counts until the step it was asked at gets done; then she moves on to the new current step.
  const cardStep = phone.open && phone.open !== 'end' ? phone.open : null;
  const fresh = asked && asked.forNext === next && asked.forCard === phone.open ? asked : null;
  const step = cardStep ?? fresh?.step ?? next ?? (page?.goLive.ready ? 'ready' : 'waiting');
  // On the phone's step cards she stands under the card's content, so the card's button stays clear.
  const under = Boolean(phone.open);
  const selector = under ? '.gk-phonesteps__body' : TARGETS[step];
  const line = thinking ? t('Thinking…') : fresh?.answer ? fresh.answer : t(LINES[step]);
  const away = hidden || Boolean(panel) || !page || page.status !== 'DRAFT';

  useEffect(() => {
    if (away) return;
    let scrolled = false, stop = 0;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!scrolled && (rect.bottom < 0 || rect.top > window.innerHeight)) { scrolled = true; target.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' }); return; }
      const to = spotFor(rect, under), from = last.current;
      if (from && Math.abs(from.x - to.x) < 2 && Math.abs(from.y - to.y) < 2) return;
      last.current = to;
      // Following the page as it scrolls is gliding; a jump to another box is a walk.
      if (from && Math.hypot(to.x - from.x, to.y - from.y) > 80 && !still) {
        setFacing(to.x < from.x ? 'left' : 'right');
        setWalking(true);
        window.clearTimeout(stop);
        stop = window.setTimeout(() => { setWalking(false); setFacing('right'); }, 1100);
      }
      setSpot(to);
    };
    const frame = window.requestAnimationFrame(measure), timer = window.setInterval(measure, 400);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); window.clearTimeout(stop); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [away, selector, still, under]);

  useEffect(() => {
    if (!walking && !thinking) return;
    const timer = window.setInterval(() => setTick(value => !value), walking ? 160 : 240);
    return () => clearInterval(timer);
  }, [walking, thinking]);

  if (!page) return null;
  if (hidden) {
    return createPortal(
      <div className="gk gk-pet">
        <button type="button" className="gk-pet__peek" aria-label={t('Show Dola')} onClick={() => { keepHidden(false); setHidden(false); }}><PetSprite frame="idle" className="gk-pet__peek-sprite" /></button>
      </div>, document.body);
  }
  if (away || !spot) return null;

  const ask = async (text: string) => {
    const words = text.trim();
    if (words.length < 2 || thinking) return;
    setThinking(true);
    const answer = await askPet(words);
    setThinking(false);
    setAsking(false);
    setQuestion('');
    setAsked({ forNext: next, forCard: phone.open, step: answer.step, answer: answer.answer ?? (answer.step ? null : t('I help with setting up your page. Tap a box to fill it.')) });
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(question); };
  const frame: PetFrame = walking ? (tick ? 'walk1' : 'walk2') : thinking ? (tick ? 'talk' : 'idle') : 'point';
  const bubbleBelow = under || spot.y < 150;
  const bubbleRight = spot.x + W / 2 < window.innerWidth / 2;

  return createPortal(
    <div className="gk gk-pet" data-still={still || undefined}>
      <div className="gk-pet__body" style={{ transform: `translate(${spot.x}px, ${spot.y}px)` }}>
        {!walking && (
          <div className="gk-pet__bubble" data-below={bubbleBelow || undefined} data-right={bubbleRight || undefined} style={bubbleRight ? undefined : { maxWidth: Math.max(180, Math.min(260, spot.x + W - EDGE)) }} role="status" aria-live="polite">
            {asking
              ? <form className="gk-pet__ask" onSubmit={submit}>
                  <input className="gk-pet__input" value={question} onChange={event => setQuestion(event.target.value)} maxLength={200} placeholder={t('Ask about setting up your page')} aria-label={t('Ask Dola')} autoComplete="off" autoFocus disabled={thinking} />
                  <span className="gk-pet__examples">{EXAMPLES.map(example => <button key={example} type="button" className="gk-pet__example" disabled={thinking} onClick={() => void ask(t(example))}>{t(example)}</button>)}</span>
                  {thinking && <span className="gk-pet__thinking">{t('Thinking…')}</span>}
                </form>
              : <p className="gk-pet__line">{line}</p>}
            <button type="button" className="gk-pet__hide" aria-label={t('Hide Dola')} onClick={() => { keepHidden(true); setHidden(true); }}><X aria-hidden="true" /></button>
          </div>
        )}
        <button type="button" className="gk-pet__pet" aria-label={t('Ask Dola')} aria-expanded={asking} onClick={() => setAsking(value => !value)}>
          <PetSprite frame={frame} className={`gk-pet__sprite${facing === 'left' ? ' gk-pet__sprite--left' : ''}`} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
