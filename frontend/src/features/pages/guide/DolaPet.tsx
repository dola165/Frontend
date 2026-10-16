import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from '../../world/useMediaQuery';
import { usePagesCopy } from '../copy';
import type { SetupKey } from '../model/kinds';
import { usePageEdit } from '../edit/context';
import { usePhoneSteps } from '../edit/usePhoneSteps';
import { stepWords } from '../edit/words';
import { askPet, type PetAnswer } from './api';
import { PetSprite, WALK_STEPS, type PetFrame } from './PetSprite';
import { QuickAnswer } from './QuickAnswer';
import { isQuick } from './quick';
import { BOX } from './petFrames';
import './pet.css';

/** What each step means for the club, in Dola's words: no model. */
const LINES: Record<string, string> = {
  name: 'How people find you, so it comes first.',
  crest: 'Your badge. It shows on your page, in search and beside every post. Upload yours or pick two colours.',
  about: 'The one line visitors read first, like “Academy in Rustavi for U8–U14”.',
  grounds: 'Where you train and play. It puts your club on the map for parents nearby.',
  squads: 'Your teams by birth year. Each gets its own calendar and join link.',
  contact: 'How parents reach you. Your phone becomes a WhatsApp button.',
  fees: 'What a month costs, or Free. Parents filter by it when they search.',
  players: 'One join link per team. Parents add their own child and you approve.',
  ready: 'That’s everything. Go live when you like; anything can change later.',
  waiting: 'To go live, add a ground or a way to reach you.',
};
/** What to do inside the pop-up a step opens; she follows the person into it. */
const PANEL_LINES: Record<string, string> = {
  crest: 'Upload your badge, or pick two colours and a shape. The page shows it at once.',
  grounds: 'Tap your pitch on the map or in the list. Not there? Type it under Another place.',
  squads: 'Say who plays, then tap the birth years you have. Each becomes a team.',
  players: 'Share a team’s link in your parents’ WhatsApp group. They add their own child.',
  staff: 'Invite a coach by phone, or share the invite link.',
};
const TITLES: Record<string, string> = { ready: 'Ready to go live', waiting: 'Almost ready' };
/** Where each step is done on the page. */
const TARGETS: Record<string, string> = {
  name: '[data-step="name"]', crest: '[data-step="crest"]', about: '[data-step="about"]', grounds: '[data-box="grounds"]', squads: '[data-box="squads"]',
  contact: '[data-box="contact"]', fees: '[data-box="fees"]', players: '[data-box="squads"]', ready: '[data-coach="live"]', waiting: '[data-coach="live"]',
};
const EXAMPLES = ['Where do I add my ground?', 'What’s a birth year?'];
const W = 84, H = Math.round(W * BOX[3] / BOX[2]), EDGE = 8, BUBBLE = 280;
const HIDDEN = 'gk-pet-hidden';
const stored = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* a private window: for this visit only */ } };

type Aim = 'down' | 'up' | 'left' | 'right';
interface Spot { x: number; y: number; aim: Aim; rect: { top: number; left: number; width: number; height: number } }
/**
 * She sits on top of the step and points down at it. A small target (a button) gets her beside it instead, and one at
 * the top of the window gets her under it; on the phone's step cards she stands under the card's content.
 */
function spotFor(rect: DOMRect, under: boolean): Spot {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - W - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - H - EDGE);
  const box = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  if (!under && rect.width < W) {
    const y = clampY(rect.top + rect.height / 2 - H / 2);
    if (rect.left >= W + EDGE * 2) return { x: rect.left - W - 4, y, aim: 'right', rect: box };
    if (rect.right + W + EDGE * 2 <= vw) return { x: rect.right + 4, y, aim: 'left', rect: box };
  }
  if (!under && rect.top - H >= EDGE) return { x: clampX(rect.left + 16), y: rect.top - H + 6, aim: 'down', rect: box };
  return { x: clampX(rect.left + 16), y: clampY(rect.bottom + 6), aim: 'up', rect: box };
}

/**
 * Agent Dola as a pet on a club's draft (a prototype beside the set-up steps). From the moment the page is made she sits
 * on the next step, points at it and says what it means, with the step lit and the rest of the page dimmed. Skip moves
 * her on (only the name is needed). A tap asks her a question: the sandbox's pet guide (Jev picks the step, DeepSeek
 * words the answer) and she walks to that step. She only guides, never fills anything in.
 */
export function DolaPet() {
  const t = usePagesCopy();
  const { pathname } = useLocation();
  const { page, panel } = usePageEdit();
  const phone = usePhoneSteps();
  const still = useMediaQuery('(prefers-reduced-motion: reduce)');
  const skipKey = `gk-pet-skipped:${pathname}`;
  const [hidden, setHidden] = useState(() => stored(HIDDEN) === '1');
  const [skipped, setSkipped] = useState<string[]>(() => (stored(skipKey) ?? '').split(',').filter(Boolean));
  const [asking, setAsking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<(PetAnswer & { forStep: string | null; forCard: string | null }) | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [walking, setWalking] = useState<'left' | 'right' | null>(null);
  const [pose, setPose] = useState<'Wave' | 'Celebrate' | null>('Wave');
  const [tick, setTick] = useState(0);
  const last = useRef<Spot | null>(null);
  const doneBefore = useRef(page?.setup.done ?? 0);

  const items = page?.setup.items ?? [];
  const pending = items.find(item => !item.done && !skipped.includes(item.key))?.key ?? null;
  const cardStep = phone.open && phone.open !== 'end' ? phone.open : null;
  // An answer counts until the step it was asked at is done or skipped; then she moves on.
  const fresh = asked && asked.forStep === pending && asked.forCard === phone.open ? asked : null;
  const step = cardStep ?? fresh?.step ?? pending ?? (page?.goLive.ready ? 'ready' : 'waiting');
  // In a step's pop-up she sits on its top edge and says what to do there; other pop-ups she leaves alone.
  const inPanel = panel && PANEL_LINES[panel] ? panel : null;
  const under = Boolean(phone.open) && !inPanel;
  const selector = inPanel ? '.gk-dialog' : under ? '.gk-phonesteps__body' : TARGETS[step];
  const away = hidden || Boolean(panel && !inPanel) || !page || page.status !== 'DRAFT';

  // She waves hello first, and cheers each time a step gets done.
  const done = page?.setup.done ?? 0;
  useEffect(() => {
    const cheer = done > doneBefore.current;
    doneBefore.current = done;
    const on = cheer ? window.setTimeout(() => setPose('Celebrate'), 0) : 0;
    const off = window.setTimeout(() => setPose(null), cheer ? 1300 : 1600);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [done]);

  useEffect(() => {
    if (away) return;
    let scrolled = false, stop = 0;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!scrolled && (rect.top < H || rect.bottom > window.innerHeight)) {
        scrolled = true;
        if (rect.bottom < 0 || rect.top > window.innerHeight - H) { target.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' }); return; }
      }
      const to = spotFor(rect, under), from = last.current;
      if (from && Math.abs(from.x - to.x) < 2 && Math.abs(from.y - to.y) < 2 && Math.abs(from.rect.height - to.rect.height) < 2) return;
      last.current = to;
      // Following the page as it scrolls is gliding; a jump to another step is a walk.
      if (from && Math.hypot(to.x - from.x, to.y - from.y) > 80 && !still) {
        setWalking(to.x < from.x ? 'left' : 'right');
        window.clearTimeout(stop);
        stop = window.setTimeout(() => setWalking(null), 1000);
      }
      setSpot(to);
    };
    const frame = window.requestAnimationFrame(measure), timer = window.setInterval(measure, 300);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); window.clearTimeout(stop); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [away, selector, still, under]);

  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(() => setTick(value => (value + 1) % WALK_STEPS.length), 130);
    return () => clearInterval(timer);
  }, [walking]);

  if (!page) return null;
  if (hidden) {
    return createPortal(
      <div className="gk gk-pet">
        <button type="button" className="gk-pet__peek" aria-label={t('Show Dola')} onClick={() => { store(HIDDEN, '0'); setHidden(false); }}><PetSprite frame="Idle · front" className="gk-pet__peek-sprite" /></button>
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
    setAsked({ forStep: pending, forCard: phone.open, step: answer.step, answer: answer.answer ?? (answer.step ? null : t('I help with setting up your page. Tap a box to fill it.')) });
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(question); };
  const skip = () => {
    if (cardStep) { const at = items.findIndex(item => item.key === cardStep); phone.show(items[at + 1]?.key ?? 'end'); return; }
    if (!pending) return;
    const next = [...skipped, pending];
    setSkipped(next);
    store(skipKey, next.join(','));
  };

  const frame: PetFrame = walking ? `Walk ${walking} · ${WALK_STEPS[tick]}` : thinking ? 'Thinking' : pose ?? `Point · ${spot.aim}`;
  const shown = inPanel ?? step;
  const isStep = items.some(item => item.key === shown);
  const title = isStep ? stepWords(page.kind, shown as SetupKey) : TITLES[shown];
  const line = inPanel ? t(PANEL_LINES[inPanel]) : fresh?.answer ?? t(LINES[step]);
  // Short answers are typed right here; the phone's step cards have their own boxes for them.
  const quick = !inPanel && !cardStep && isQuick(step) ? step : null;
  const vw = window.innerWidth;
  const side = under ? 'below' : spot.x + W + 8 + BUBBLE <= vw ? 'right' : spot.x - 8 - BUBBLE >= 0 ? 'left' : spot.y > 220 ? 'above' : 'below';

  return createPortal(
    <div className="gk gk-pet" data-still={still || undefined}>
      {!under && !inPanel && <div className="gk-pet__spot" style={{ top: spot.rect.top - 6, left: spot.rect.left - 6, width: spot.rect.width + 12, height: spot.rect.height + 12 }} />}
      <div className="gk-pet__body" style={{ transform: `translate(${spot.x}px, ${spot.y}px)` }}>
        {!walking && (
          <div className="gk-pet__bubble" data-side={side} role="status" aria-live="polite">
            <button type="button" className="gk-pet__hide" aria-label={t('Hide Dola')} onClick={() => { store(HIDDEN, '1'); setHidden(true); }}><X aria-hidden="true" /></button>
            {asking
              ? <form className="gk-pet__ask" onSubmit={submit}>
                  <input className="gk-pet__input" value={question} onChange={event => setQuestion(event.target.value)} maxLength={200} placeholder={t('Ask about setting up your page')} aria-label={t('Ask Dola')} autoComplete="off" autoFocus disabled={thinking} />
                  <span className="gk-pet__examples">{EXAMPLES.map(example => <button key={example} type="button" className="gk-pet__example" disabled={thinking} onClick={() => void ask(t(example))}>{t(example)}</button>)}</span>
                  {thinking && <span className="gk-pet__thinking">{t('Thinking…')}</span>}
                </form>
              : <>
                  {title && <strong className="gk-pet__title">{t(title)}</strong>}
                  <p className="gk-pet__line">{line}</p>
                  {quick && <QuickAnswer key={quick} step={quick} page={page} />}
                  {!inPanel && <span className="gk-pet__actions">
                    {isStep && <button type="button" className="gk-pet__action" onClick={skip}>{t('Skip')}</button>}
                    <button type="button" className="gk-pet__action gk-pet__action--quiet" onClick={() => setAsking(true)}>{t('Ask me')}</button>
                  </span>}
                </>}
          </div>
        )}
        <button type="button" className="gk-pet__pet" aria-label={t('Ask Dola')} aria-expanded={asking} onClick={() => setAsking(value => !value)}>
          <PetSprite frame={frame} className="gk-pet__sprite" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
