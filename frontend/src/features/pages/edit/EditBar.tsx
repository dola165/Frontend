import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, LayoutList, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import { claimHref } from '../create/entry';
import { usePageEdit } from './context';
import { CoachMarks } from './CoachMarks';
import { StepsMenu } from './StepsMenu';
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
  // The first time on a claimed page, one hint, once; a new page gets the short walkthrough instead (CoachMarks).
  useEffect(() => {
    if (arrival !== 'claimed' || !page) return;
    toast(t('This page is yours now. Tap a box to fill it.'), { id: 'page-arrival', duration: 6000 });
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
  const missing = page.goLive.missing.map(item => t(MISSING[item]));
  return (
    <div className="gk-editbar" data-editing={editing || undefined}>
      {arrival === 'new' && editing && <CoachMarks pageRef={page.ref} />}
      {page.status === 'DRAFT'
        ? <span className="gk-editbar__draft"><span className="gk-editbar__dot" aria-hidden="true" />{t('Draft · only you see this')}</span>
        : page.claim?.state === 'PENDING' ? <span className="gk-editbar__claim"><span className="gk-editbar__dot" aria-hidden="true" />{t('Claim pending verification')}</span> : null}
      {!setup.completedAt && <StepsMenu page={page} />}
      {!setup.completedAt && page.kind === 'CLUB' && <button type="button" className="gk-editbar__example" onClick={() => openPanel('example')}><Eye aria-hidden="true" size={12} />{t('What a finished club looks like')}</button>}
      <span className="gk-editbar__saved" role="status" aria-live="polite" aria-label={t('Save status')} data-status={status}>
        {status === 'saving' ? t('Saving…') : status === 'saved' ? t('Saved') : status === 'failed' ? t('Not saved') : pendingCount ? t('{n} edits waiting', { n: pendingCount }) : ''}
      </span>
      <span className="gk-editbar__actions">
        {page.status === 'DRAFT' && !page.goLive.ready && <span className="gk-editbar__missing">{t('To go live: {missing}', { missing: missing.join(', ') })}</span>}
        {page.status === 'DRAFT' && <Button size="sm" variant="primary" data-coach="live" data-ready={page.goLive.ready || undefined} disabled={!page.goLive.ready} onClick={() => void goLive()}>{t('Go live')}</Button>}
        {editing && <Button size="sm" variant={rearranging ? 'primary' : 'ghost'} aria-pressed={rearranging} onClick={() => setRearranging(!rearranging)}><LayoutList aria-hidden="true" />{t('Rearrange')}</Button>}
        {editing
          ? <Button size="sm" onClick={() => setEditing(false)}>{t('Done')}</Button>
          : <Button size="sm" variant="primary" onClick={() => setEditing(true)}><PenLine aria-hidden="true" />{t('Edit page')}</Button>}
      </span>
    </div>
  );
}
