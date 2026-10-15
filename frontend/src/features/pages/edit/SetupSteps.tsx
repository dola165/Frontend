import { useEffect, useId, useRef, useState } from 'react';
import { AlignLeft, Check, ChevronDown, ChevronRight, ChevronUp, Coins, Handshake, Link2, MapPin, MessageSquare, Phone, Shield, Type, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { usePagesCopy } from '../copy';
import { SETUP_ITEMS, type SetupKey } from '../model/kinds';
import { SETUP_PANEL, usePageEdit } from './context';
import { SETUP_WORDS } from './words';
import './edit.css';

const ICONS: Record<SetupKey, LucideIcon> = { name: Type, crest: Shield, about: AlignLeft, grounds: MapPin, squads: Users, contact: Phone, fees: Coins, players: Link2, staff: UserPlus, posts: MessageSquare, sponsors: Handshake };
/** One line under each step, what it gives the club. */
const WHY: Record<SetupKey, string> = {
  name: 'How people find you', crest: 'Your badge, everywhere', about: 'The one or two lines visitors read first', grounds: 'Puts you on the map',
  squads: 'Makes the calendar and the join links', contact: 'Phone and WhatsApp for parents', fees: 'Shows in parents’ searches', players: 'One link per squad to share',
  staff: 'They act for the club', posts: 'What visitors see first', sponsors: 'Who you back',
};

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
 * The set-up steps, the main thing on a page still being made: a card at the top of the main column, always open,
 * every step a tall row (its picture, its words, what it gives the club), ticked when done, the next one lit. A tap
 * opens the step where it is done. When a step gets done the card glows and the next row lights up. Any order.
 */
export function SetupSteps() {
  const t = usePagesCopy();
  const { page, editing, openPanel } = usePageEdit();
  const [collapsed, setCollapsed] = useState(false);
  const [glow, setGlow] = useState(false);
  const done = page?.setup.done ?? 0;
  const previous = useRef(done);
  const id = useId();
  // A step just got done: the card glows for a moment and the next step takes the light.
  useEffect(() => {
    if (done <= previous.current) { previous.current = done; return; }
    previous.current = done;
    const on = window.setTimeout(() => setGlow(true), 0), off = window.setTimeout(() => setGlow(false), 1800);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [done]);
  if (!page || !editing || page.setup.completedAt) return null;
  const total = SETUP_ITEMS[page.kind].length, next = page.setup.next;
  return (
    <section id="gk-setup" className="gk-setup" data-glow={glow || undefined} aria-labelledby={`${id}-title`}>
      <header className="gk-setup__head" data-coach="ring">
        <SetupRing done={done} total={total} size={48} />
        <div className="gk-setup__words">
          <h2 id={`${id}-title`} className="gk-setup__title">{t('Set-up steps')}</h2>
          <p className="gk-setup__count">{t('{done} of {total} done · any order', { done, total })}</p>
        </div>
        <button type="button" className="gk-setup__toggle" aria-expanded={!collapsed} aria-controls={`${id}-list`} onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}<span className="gk-visually-hidden">{t(collapsed ? 'Show the steps' : 'Hide the steps')}</span>
        </button>
      </header>
      {!collapsed && (
        <ol id={`${id}-list`} className="gk-setup__list">
          {page.setup.items.map(item => {
            const Icon = ICONS[item.key];
            return (
              <li key={item.key}>
                <button type="button" className="gk-setup__step" data-done={item.done || undefined} data-next={item.key === next || undefined} onClick={() => openPanel(SETUP_PANEL[item.key])}>
                  <span className="gk-setup__icon"><Icon aria-hidden="true" /></span>
                  <span className="gk-setup__text"><span className="gk-setup__name">{t(SETUP_WORDS[item.key])}</span><span className="gk-setup__why">{t(WHY[item.key])}</span></span>
                  {item.done
                    ? <span className="gk-setup__state gk-setup__state--done"><Check aria-hidden="true" />{t('Done')}</span>
                    : item.key === next ? <span className="gk-setup__state gk-setup__state--next">{t('Next')}<ChevronRight aria-hidden="true" /></span>
                    : <span className="gk-setup__state"><ChevronRight aria-hidden="true" /></span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
