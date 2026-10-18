import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Dialog } from '../../../design/Dialog';
import { Button, ButtonLink, EmptyNote, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { recordFunnelEvent } from '../../feed/feedEvents';
import { Crest } from '../../world/Crest';
import { claimPage, fetchPage, type PageRef, type PageView } from '../api';
import { usePagesCopy } from '../copy';
import { pagePath, type CreateFrom } from './entry';
import '../pages.css';

const ROLES = [['CHAIR', 'I run it'], ['COACH', 'I coach there'], ['ADMIN', 'I do the admin'], ['OTHER', 'Something else']] as const;
type ClaimRole = typeof ROLES[number][0];

/**
 * Claim evidence is private. Submission records a receipt and never grants editing or a verified badge.
 */
type ClaimProps = { pageRef: PageRef; from: CreateFrom; onClose: () => void };
export function ClaimSheet(props: ClaimProps) {
  const { user } = useAuth();
  return <ClaimForm key={`${user?.id ?? 'guest'}:${props.pageRef.type}:${props.pageRef.id}`} {...props} />;
}
function ClaimForm({ pageRef, from, onClose }: ClaimProps) {
  const t = usePagesCopy();
  const [page, setPage] = useState<PageView | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [role, setRole] = useState<ClaimRole>('CHAIR');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const phoneId = useId();

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false); setPage(null); setPhone(''); setRole('CHAIR'); setError(''); requestId.current = crypto.randomUUID();
    fetchPage(pageRef, controller.signal).then(view => {
      if (controller.signal.aborted) return;
      setPage(view);
      if (view.claim?.mine && view.claim.state === 'REJECTED') {
        setPhone(view.claim.evidence?.phone ?? '');
        const previousRole = view.claim.role;
        if (ROLES.some(([value]) => value === previousRole)) setRole(previousRole as ClaimRole);
      }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [pageRef.id, pageRef.type, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- the ref's two fields are the key
  useEffect(() => { recordFunnelEvent('PAGE_CLAIM_STARTED', { from, pageRef: `${pageRef.type}-${pageRef.id}` }); }, [from, pageRef.id, pageRef.type]);

  const claimable = page?.viewer.canClaim === true;
  const mine = page?.claim?.mine === true;
  const digits = phone.replace(/\D/g, '');
  const submit = async () => {
    if (busy || !page || !claimable) return;
    if (digits.length < 9) { setError(t('Add a phone number we can call.')); return; }
    setBusy(true); setError('');
    try {
      const claimed = await claimPage(pageRef, { requestId: requestId.current, expectedVersion: page.claimRevision ?? page.claim?.revision ?? 0, role, phone });
      recordFunnelEvent('PAGE_CLAIM_FINISHED', { pageRef: `${pageRef.type}-${pageRef.id}` });
      setPage(claimed);
    } catch (failure) { setError(extractApiErrorMessage(failure, t('Could not claim the page. Try again.'))); }
    finally { setBusy(false); }
  };

  const title = page ? t('Claim {name}', { name: page.identity.name }) : t('Claim it');
  return (
    <Dialog open size="sm" title={title} onClose={onClose} closeLabel={t('Not now')}
      footer={claimable ? <>
        <Button variant="ghost" onClick={onClose}>{t('Not now')}</Button>
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? <><Loader2 className="gk-spin" aria-hidden="true" />{t('Claiming…')}</> : t('Claim it')}</Button>
      </> : undefined}>
      {failed ? <EmptyNote title={t('This page couldn’t load')} action={<Button size="sm" onClick={() => setAttempt(value => value + 1)}>{t('Try again')}</Button>} />
        : !page ? <div className="gk-stack gk-stack--tight" role="status"><Skeleton height={44} /><Skeleton height={34} /></div>
        : <>
          <div className="gk-cmatch__page">
            <Crest src={page.identity.crest.url} name={page.identity.name} size={44} />
            <span className="gk-cmatch__text"><strong>{page.identity.name}</strong><small>{page.identity.town.name}</small></span>
          </div>
          {mine && <div className="gk-stack gk-stack--tight" role="status">
            <strong>{t(page.claim?.state === 'PENDING' ? 'Claim submitted for review' : page.claim?.state === 'APPROVED' ? 'Claim evidence approved' : 'Claim rejected')}</strong>
            <p>{t('Submitting a claim does not give editing access or a verified badge.')}</p>
            {page.claim?.id && <small>{t('Receipt: {id}', { id: page.claim.id })}</small>}
            {page.claim?.reason && <p>{page.claim.reason}</p>}
            {page.claim?.id && <ButtonLink size="sm" to={`/pages/requests/${encodeURIComponent(page.claim.id)}`} onClick={onClose}>{t('View request')}</ButtonLink>}
            <ButtonLink size="sm" to={pagePath(pageRef)} onClick={onClose}>{t('Open page')}</ButtonLink>
          </div>}
          {!claimable && !mine ? <EmptyNote title={t(page.claim?.state === 'PENDING' ? 'A claim is awaiting review.' : 'Someone already runs this page.')} action={<ButtonLink size="sm" to={pagePath(pageRef)} onClick={onClose}>{t('Open page')}</ButtonLink>}>{t('Ask them to add you.')}</EmptyNote> : claimable ? <>
            <div className="gk-cname">
              <p className="gk-field__label">{t(page.kind === 'CLUB' ? 'What do you do at the club?' : 'What do you do there?')}</p>
              <div className="gk-ctowns" role="group" aria-label={t('What do you do there?')}>
                {ROLES.map(([value, label]) => <button key={value} type="button" className="gk-chip" aria-pressed={role === value} disabled={busy} onClick={() => { setRole(value); requestId.current = crypto.randomUUID(); }}>{t(label)}</button>)}
              </div>
            </div>
            <div className="gk-cname">
              <label className="gk-field__label" htmlFor={phoneId}>{t('Phone')}</label>
              <input id={phoneId} className="gk-input" type="tel" inputMode="tel" autoComplete="tel" value={phone} placeholder="+995 5__ __ __ __" maxLength={24} disabled={busy}
                onChange={event => { setPhone(event.target.value); setError(''); requestId.current = crypto.randomUUID(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }} />
              <span className="gk-field__hint">{t('To reach you about it, by message. Nothing is published.')}</span>
            </div>
            {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
            <p className="gk-field__hint">{t('Submitting a claim does not give editing access or a verified badge.')}</p>
          </> : null}
        </>}
    </Dialog>
  );
}
