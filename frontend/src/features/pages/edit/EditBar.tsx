import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, Eye, LayoutList, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import { claimHref } from '../create/entry';
import { usePageEdit } from './context';
import { SETUP_ITEMS } from '../model/kinds';
import { DolaPet } from '../guide/DolaPet';
import { DeleteDraft } from './DeleteDraft';
import { PhoneSteps } from './PhoneSteps';
import { usePhoneSteps } from './usePhoneSteps';
import { SetupRing, SetupSteps } from './SetupSteps';
import { STEP_ICONS, stepWords } from './words';
import './edit.css';


/**
 * The line under a page's header while its owner is there: "Draft · only you see this" with Go live, the setup
 * ring ("4 of 7 · Where do you play?"), a quiet "Saved", and the Edit page switch. Visitors to an unclaimed page
 * see "Is this your club? Claim it" here instead.
 */
export function EditBar() {
  const t = usePagesCopy();
  const location = useLocation();
  const { page, editing, canEdit, setEditing, openPanel, openStep, goLive, status, arrival, pendingCount, rearranging, setRearranging } = usePageEdit();
  // The first time on a claimed page, one hint, once. A new page gets no tour: the current step is the one thing it shows.
  useEffect(() => {
    if (arrival !== 'claimed' || !page) return;
    toast(t('This page is yours now. Tap a box to fill it.'), { id: 'page-arrival', duration: 6000 });
  }, [arrival, page, t]);
  // The steps drop down from the bar when the ring is pressed; they start folded, so the current step is the one thing in view.
  const [stepsOpen, setStepsOpen] = useState(false);
  // On a phone a draft is set up one full-screen card per step; the current step opens its card.
  const phoneSteps = usePhoneSteps();
  if (!page) return null;
  if (!canEdit) {
    if (page.claim?.state !== 'UNCLAIMED' || !page.viewer.canClaim) return null;
    return (
      <div className="gk-editbar">
        <span className="gk-editbar__claim"><span className="gk-editbar__dot" aria-hidden="true" />{t(page.kind === 'CLUB' ? 'Is this your club?' : 'Is this your page?')}</span>
        <span className="gk-editbar__actions"><ButtonLink size="sm" variant="primary" to={claimHref(location, page.ref, 'link')}>{t('Claim it')}</ButtonLink></span>
      </div>
    );
  }
  const setup = page.setup;
  const total = SETUP_ITEMS[page.kind].length, next = setup.next;
  const CurrentIcon = next ? STEP_ICONS[next] : null;
  return (
    <div className="gk-editbar" data-editing={editing || undefined}>
      <PhoneSteps />
      {editing && page.kind === 'CLUB' && <DolaPet />}
      {page.status === 'DRAFT'
        ? <span className="gk-editbar__draft"><span className="gk-editbar__dot" aria-hidden="true" />{t('Draft · only you see this')}</span>
        : page.claim?.state === 'PENDING' ? <span className="gk-editbar__claim"><span className="gk-editbar__dot" aria-hidden="true" />{t('Claim pending verification')}</span> : null}
      {!setup.completedAt && (
        <button type="button" className="gk-ring" aria-expanded={stepsOpen} onClick={() => setStepsOpen(value => !value)} aria-label={t('{done} of {total} done. Set-up steps', { done: setup.done, total })}>
          <SetupRing done={setup.done} total={total} />
          <span key={setup.done} className="gk-ring__count">{t('{done} of {total}', { done: setup.done, total })}</span>
          <span className="gk-ring__next">{t('Set-up steps')}</span>
        </button>
      )}
      {!setup.completedAt && page.kind === 'CLUB' && <button type="button" className="gk-editbar__example" onClick={() => openPanel('example')}><Eye aria-hidden="true" size={12} />{t('What a finished club looks like')}</button>}
      {!setup.completedAt && next && CurrentIcon && (
        <span className="gk-editbar__current-wrap">
          <button type="button" className="gk-editbar__current" onClick={() => (phoneSteps.available ? phoneSteps.show(next) : openStep(next))}><span className="gk-editbar__current-label">{t('Current step')}</span><CurrentIcon aria-hidden="true" /><strong>{t(stepWords(page.kind, next))}</strong><ChevronRight aria-hidden="true" /></button>
          {editing && stepsOpen && <div className="gk-editbar__steps"><SetupSteps onClose={() => setStepsOpen(false)} /></div>}
        </span>
      )}
      <span className="gk-editbar__saved" role="status" aria-live="polite" aria-label={t('Save status')} data-status={status}>
        {status === 'saving' ? t('Saving…') : status === 'saved' ? t('Saved') : status === 'failed' ? t('Not saved') : pendingCount ? t('{n} edits waiting', { n: pendingCount }) : ''}
      </span>
      <span className="gk-editbar__actions">
        {page.status === 'DRAFT' && !page.goLive.ready && <span className="gk-editbar__missing">{t('To go live, name your page.')}</span>}
        {page.status === 'DRAFT' && <Button size="sm" variant="primary" data-coach="live" data-ready={page.goLive.ready || undefined} disabled={!page.goLive.ready} onClick={() => void goLive()}>{t('Go live')}</Button>}
        {editing && <Button size="sm" variant={rearranging ? 'primary' : 'ghost'} aria-pressed={rearranging} onClick={() => setRearranging(!rearranging)}><LayoutList aria-hidden="true" />{t('Rearrange')}</Button>}
        {editing
          ? <Button size="sm" onClick={() => setEditing(false)}>{t('Done')}</Button>
          : <Button size="sm" variant="primary" onClick={() => setEditing(true)}><PenLine aria-hidden="true" />{t('Edit page')}</Button>}
        <DeleteDraft page={page} />
      </span>
    </div>
  );
}
