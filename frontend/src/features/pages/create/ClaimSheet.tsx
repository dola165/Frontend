import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * Claiming a known page that nobody runs yet: what you do there and a phone number. The sandbox accepts at once and
 * marks the claim "pending verification"; afterwards the page opens in edit mode with what was already known filled in.
 */
export function ClaimSheet({ pageRef, from, onClose }: { pageRef: PageRef; from: CreateFrom; onClose: () => void }) {
  const t = usePagesCopy();
  const { refreshNavigationCapabilities } = useAuth();
  const navigate = useNavigate();
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
    setFailed(false);
    fetchPage(pageRef, controller.signal).then(view => { if (!controller.signal.aborted) setPage(view); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [pageRef.id, pageRef.type, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- the ref's two fields are the key
  useEffect(() => { recordFunnelEvent('PAGE_CLAIM_STARTED', { from, pageRef: `${pageRef.type}-${pageRef.id}` }); }, [from, pageRef.id, pageRef.type]);

  const claimable = page?.claim?.state === 'UNCLAIMED' && page.viewer.canClaim;
  const digits = phone.replace(/\D/g, '');
  const submit = async () => {
    if (busy || !page) return;
    if (digits.length < 9) { setError(t('Add a phone number we can call.')); return; }
    setBusy(true); setError('');
    try {
      const claimed = await claimPage(pageRef, { requestId: requestId.current, role, phone });
      recordFunnelEvent('PAGE_CLAIM_FINISHED', { pageRef: `${pageRef.type}-${pageRef.id}` });
      void refreshNavigationCapabilities().catch(() => undefined);
      navigate(`${claimed.links.profilePath}?edit=1&claimed=1`);
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
          {!claimable ? <EmptyNote title={t('Someone already runs this page.')} action={<ButtonLink size="sm" to={pagePath(pageRef)} onClick={onClose}>{t('Open page')}</ButtonLink>}>{t('Ask them to add you.')}</EmptyNote> : <>
            <div className="gk-cname">
              <p className="gk-field__label">{t(page.kind === 'CLUB' ? 'What do you do at the club?' : 'What do you do there?')}</p>
              <div className="gk-ctowns" role="group" aria-label={t('What do you do there?')}>
                {ROLES.map(([value, label]) => <button key={value} type="button" className="gk-chip" aria-pressed={role === value} onClick={() => setRole(value)}>{t(label)}</button>)}
              </div>
            </div>
            <div className="gk-cname">
              <label className="gk-field__label" htmlFor={phoneId}>{t('Phone')}</label>
              <input id={phoneId} className="gk-input" type="tel" inputMode="tel" autoComplete="tel" value={phone} placeholder="+995 5__ __ __ __" maxLength={20}
                onChange={event => { setPhone(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }} />
              <span className="gk-field__hint">{t('We call to confirm. Nothing is published.')}</span>
            </div>
            {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
          </>}
        </>}
    </Dialog>
  );
}
