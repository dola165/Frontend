import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { defaultBoxes } from '../boxes/defaultBoxes';
import { usePagesCopy } from '../copy';
import type { SetupKey } from '../model/kinds';
import { AboutLine } from './AboutLine';
import { InlineText } from './InlineText';
import { SETUP_PANEL, usePageEdit } from './context';
import { usePhoneSteps } from './usePhoneSteps';
import { STEP_ICONS, stepWhy, stepWords } from './words';
import './phone-steps.css';

const END = 'end';
/** What the big button on a step's card says, for the steps that open a panel. */
const ACTION: Partial<Record<SetupKey, string>> = { crest: 'Change the crest', grounds: 'Pick on the map', squads: 'Choose the teams', players: 'Share the join links', staff: 'Invite someone', sponsors: 'Add a sponsor' };
/** Steps whose box is filled right on the card. */
const IN_PLACE: readonly SetupKey[] = ['contact', 'fees'];

/**
 * On a phone, setting up a draft is one full-screen card per step, like stories: a bar per step at the top, the step's
 * picture and words, and the thing itself (the contact and fees boxes fill right on the card; the crest, the map and
 * the teams open their own full-screen sheet). Next and Back move between cards, any order; the page appears at the end.
 */
export function PhoneSteps() {
  const t = usePagesCopy();
  const { page, editing, arrival, panel, openPanel, closePanel, saveIdentity, goLive } = usePageEdit();
  const steps = usePhoneSteps();
  const started = useRef(false);
  const wasDone = useRef<{ key: string | null; done: boolean }>({ key: null, done: false });
  // A new page on a phone opens straight into its first step that is not done.
  useEffect(() => {
    if (started.current || !steps.available || !editing || arrival !== 'new' || !page) return;
    started.current = true;
    steps.show(page.setup.next ?? END);
  }, [arrival, editing, page, steps]);
  // A step that gets done on its card (a sheet saved) moves on to the next card by itself, after a beat.
  const openKey = steps.open, openDone = Boolean(page?.setup.items.find(item => item.key === openKey)?.done);
  const nextKey = page?.setup.items[page.setup.items.findIndex(item => item.key === openKey) + 1]?.key ?? 'end';
  const show = useRef(steps.show);
  useEffect(() => { show.current = steps.show; });
  useEffect(() => {
    // Judged once the sheet is closed: the card the owner comes back to moves on if the sheet got the step done.
    if (panel) return;
    const before = wasDone.current;
    wasDone.current = { key: openKey, done: openDone };
    if (before.key !== openKey || before.done || !openDone) return;
    const timer = window.setTimeout(() => show.current(nextKey), 700);
    return () => clearTimeout(timer);
  }, [openKey, openDone, nextKey, panel]);
  if (!page || !steps.open) return null;
  const items = page.setup.items;
  const index = items.findIndex(item => item.key === steps.open);
  const at = index === -1 ? items.length : index;
  const key = items[at]?.key ?? null;
  const go = (to: number) => steps.show(to >= items.length ? END : items[Math.max(0, to)].key);
  const done = Boolean(key && items[at].done);
  const Icon = key ? STEP_ICONS[key] : Check;
  const View = key && IN_PLACE.includes(key) ? defaultBoxes[key as 'contact' | 'fees']?.View : null;

  const body = () => {
    if (!key) return <div className="gk-phonesteps__end">
      <p className="gk-phonesteps__count">{t('{done} of {total} done', { done: page.setup.done, total: items.length })}</p>
      {page.goLive.ready
        ? <Button variant="primary" className="gk-phonesteps__cta" onClick={() => void goLive()}>{t('Go live')}</Button>
        : <p className="gk-muted">{t('To go live, name your page.')}</p>}
    </div>;
    if (View) return <View page={page} editing open onEdit={() => undefined} onClose={() => go(at + 1)} />;
    if (key === 'name') return <InlineText as="h1" value={page.identity.name} placeholder={t('Name your page')} label={t('Name')} maxLength={120} className="gk-phonesteps__name"
      onSave={next => { if (next.length >= 2) void saveIdentity({ name: next }, { label: t('Name saved') }); }} />;
    if (key === 'about') return <div className="gk-phonesteps__about"><AboutLine /></div>;
    const summary = key === 'crest' ? <Crest src={page.identity.crest.url} name={page.identity.name} size={96} />
      : key === 'grounds' ? page.boxes.grounds.items.map(ground => ground.name).join(' · ')
      : key === 'squads' ? page.boxes.squads.items.map(squad => squad.name).join(' · ')
      : null;
    return <>
      {summary && <div className="gk-phonesteps__summary">{summary}</div>}
      <Button variant={done ? 'secondary' : 'primary'} className="gk-phonesteps__cta" onClick={() => openPanel(SETUP_PANEL[key])}>{t(ACTION[key] ?? stepWords(page.kind, key))}</Button>
    </>;
  };

  return createPortal(
    <div className="gk gk-phonesteps" role="dialog" aria-modal="true" aria-label={t('Set-up steps')}>
      <div className="gk-phonesteps__bars" aria-hidden="true">{items.map((item, i) => <span key={item.key} data-done={item.done || undefined} data-on={i === at || undefined} />)}</div>
      <header className="gk-phonesteps__head">
        <span className="gk-phonesteps__step">{key ? t('Step {n} of {total}', { n: at + 1, total: items.length }) : t('All set')}</span>
        <button type="button" className="gk-phonesteps__close" aria-label={t('See the page')} onClick={() => { closePanel(); steps.show(null); }}><X aria-hidden="true" /></button>
      </header>
      <main className="gk-phonesteps__card" key={key ?? END}>
        <span className="gk-phonesteps__icon" data-done={done || undefined}>{done ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}</span>
        <h2 className="gk-phonesteps__title">{key ? t(stepWords(page.kind, key)) : t('Your page is ready')}</h2>
        <p className="gk-phonesteps__why">{key ? t(stepWhy(page.kind, key)) : t('Anything can change later, right on the page.')}</p>
        <div className="gk-phonesteps__body">{body()}</div>
      </main>
      <footer className="gk-phonesteps__foot">
        {at > 0 ? <Button variant="ghost" onClick={() => go(at - 1)}><ArrowLeft aria-hidden="true" />{t('Back')}</Button> : <span />}
        {key ? <Button variant={done ? 'primary' : 'secondary'} onClick={() => go(at + 1)}>{done ? t('Next') : t('Skip for now')}</Button>
          : <Button onClick={() => steps.show(null)}>{t('See your page')}</Button>}
      </footer>
    </div>,
    document.body,
  );
}
