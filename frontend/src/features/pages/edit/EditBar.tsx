import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutList, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import { SETUP_ITEMS } from '../model/kinds';
import { claimHref } from '../create/entry';
import { SETUP_PANEL, usePageEdit } from './context';
import { SETUP_WORDS } from './words';
import './edit.css';

const MISSING: Record<'name' | 'crest' | 'groundOrContact', string> = { name: 'a name', crest: 'a crest', groundOrContact: 'a ground or a way to reach you' };

/**
 * The line under a page's header while its owner is there: "Draft · only you see this" with Go live, the setup
 * ring ("4 of 7 · Where do you play?"), a quiet "Saved", and the Edit page switch. Visitors to an unclaimed page
 * see "Is this your club? Claim it" here instead.
 */
export function EditBar() {
  const t = usePagesCopy();
  const location = useLocation();
  const { page, editing, canEdit, setEditing, openPanel, goLive, status, arrival, pendingCount, rearranging, setRearranging } = usePageEdit();
  // The first time on a new or claimed page, one hint, once.
  useEffect(() => {
    if (!arrival || !page) return;
    toast(arrival === 'new' ? t('Your page exists. Tap a box to fill it.') : t('This page is yours now. Tap a box to fill it.'), { id: 'page-arrival', duration: 6000 });
  }, [arrival, page, t]);
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
  const total = SETUP_ITEMS[page.kind].length;
  const next = setup.next;
  const missing = page.goLive.missing.map(item => t(MISSING[item]));
  return (
    <div className="gk-editbar" data-editing={editing || undefined}>
      {page.status === 'DRAFT'
        ? <span className="gk-editbar__draft"><span className="gk-editbar__dot" aria-hidden="true" />{t('Draft · only you see this')}</span>
        : page.claim?.state === 'PENDING' ? <span className="gk-editbar__claim"><span className="gk-editbar__dot" aria-hidden="true" />{t('Claim pending verification')}</span> : null}
      {!setup.completedAt && next && (
        <button type="button" className="gk-ring" onClick={() => openPanel(SETUP_PANEL[next])} aria-label={t('{done} of {total} done. Next: {next}', { done: setup.done, total, next: t(SETUP_WORDS[next]) })}>
          <SetupRing done={setup.done} total={total} />
          <span className="gk-ring__count">{t('{done} of {total}', { done: setup.done, total })}</span>
          <span className="gk-ring__next">{t(SETUP_WORDS[next])}</span>
        </button>
      )}
      <span className="gk-editbar__saved" role="status" aria-live="polite" aria-label={t('Save status')} data-status={status}>
        {status === 'saving' ? t('Saving…') : status === 'saved' ? t('Saved') : status === 'failed' ? t('Not saved') : pendingCount ? t('{n} edits waiting', { n: pendingCount }) : ''}
      </span>
      <span className="gk-editbar__actions">
        {page.status === 'DRAFT' && !page.goLive.ready && <span className="gk-editbar__missing">{t('To go live: {missing}', { missing: missing.join(', ') })}</span>}
        {page.status === 'DRAFT' && <Button size="sm" variant="primary" disabled={!page.goLive.ready} onClick={() => void goLive()}>{t('Go live')}</Button>}
        {editing && <Button size="sm" variant={rearranging ? 'primary' : 'ghost'} aria-pressed={rearranging} onClick={() => setRearranging(!rearranging)}><LayoutList aria-hidden="true" />{t('Rearrange')}</Button>}
        {editing
          ? <Button size="sm" onClick={() => setEditing(false)}>{t('Done')}</Button>
          : <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><PenLine aria-hidden="true" />{t('Edit page')}</Button>}
      </span>
    </div>
  );
}

/** A small ring filling up as the page is set up. */
function SetupRing({ done, total }: { done: number; total: number }) {
  const radius = 11, length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <circle className="gk-ring__track" cx="14" cy="14" r={radius} />
      <circle className="gk-ring__fill" cx="14" cy="14" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - (total ? done / total : 0))} />
    </svg>
  );
}
