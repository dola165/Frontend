import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { requestVerification } from '../api';
import { usePagesCopy } from '../copy';
import { usePageEdit } from '../edit/context';
import { type LockedAction } from '../model/kinds';
import { UNLOCK_WORDS } from './words';
import '../pages.css';

/**
 * Private verification evidence and the current receipt. Approval follows the server's existing review policy.
 */
type UnlockProps = { action: LockedAction; onClose: () => void };
export function UnlockSheet(props: UnlockProps) {
  const { user } = useAuth();
  const { page } = usePageEdit();
  return <VerificationForm key={`${user?.id ?? 'guest'}:${page?.ref.type}:${page?.ref.id}`} {...props} />;
}
function VerificationForm({ action, onClose }: UnlockProps) {
  const t = usePagesCopy();
  const { page, replace } = usePageEdit();
  const [legalName, setLegalName] = useState(page?.verificationRequest?.evidence.legalName ?? page?.identity.name ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(page?.verificationRequest?.evidence.registrationNumber ?? '');
  const [phone, setPhone] = useState(page?.verificationRequest?.evidence.phone || page?.identity.contact.phone || page?.suggestions?.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const id = useId();
  if (!page) return null;
  const requested = page.verification === 'REQUESTED', verified = page.verification === 'VERIFIED';
  const receipt = page.verificationRequest;
  const thing = t(page.kind === 'CLUB' ? 'club' : 'page');
  const send = async () => {
    if (busy || requested || verified || legalName.trim().length < 2 || phone.replace(/\D/g, '').length < 9) return;
    setBusy(true); setError('');
    try { const saved = await requestVerification(page.ref, { requestId: requestId.current, expectedVersion: page.verificationRevision ?? 0, action, legalName: legalName.trim(), registrationNumber: registrationNumber.trim(), phone: phone.trim() }); if (alive.current) replace(saved); }
    catch (failure) { setError(extractApiErrorMessage(failure, t('Could not send. Try again.'))); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open size="sm" title={verified ? t('Verified') : requested ? t('Verification requested') : t('To {do}, verify your {thing}', { do: t(UNLOCK_WORDS[action]), thing })} description={requested || verified ? undefined : t('Your details are private. A system administrator reviews the request; sending it does not verify the page.')} onClose={onClose} closeLabel={t('Not now')}
      footer={requested || verified ? <Button variant="primary" onClick={onClose}>{t('Done')}</Button> : <><Button variant="ghost" onClick={onClose}>{t('Not now')}</Button><Button variant="primary" disabled={busy || legalName.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={() => void send()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{t('Send')}</Button></>}>
      {receipt && <div role="status" className="gk-stack gk-stack--tight"><strong>{t(receipt.status === 'REJECTED' ? 'Verification request rejected' : receipt.status === 'APPROVED' ? 'Verification approved' : 'Verification requested')}</strong><small>{t('Receipt: {id}', { id: receipt.id })}</small>{receipt.reason && <p>{receipt.reason}</p>}</div>}
      {requested || verified
        ? <p>{t(verified ? 'The current page status is verified.' : 'Your request is saved and awaiting review. You can return here to check the outcome.')}</p>
        : <div className="gk-boxedit">
          <div><label className="gk-field__label" htmlFor={`${id}-legal`}>{t('Legal name')}</label><input id={`${id}-legal`} className="gk-input" autoFocus value={legalName} disabled={busy} maxLength={160} onChange={event => { setLegalName(event.target.value); requestId.current = crypto.randomUUID(); }} /><span className="gk-field__hint">{t('As registered, or your own name for an informal club.')}</span></div>
          <div><label className="gk-field__label" htmlFor={`${id}-reg`}>{t('Registration number')}</label><input id={`${id}-reg`} className="gk-input" value={registrationNumber} disabled={busy} maxLength={40} placeholder={t('If there is one')} onChange={event => { setRegistrationNumber(event.target.value); requestId.current = crypto.randomUUID(); }} /></div>
          <div><label className="gk-field__label" htmlFor={`${id}-phone`}>{t('Phone')}</label><input id={`${id}-phone`} className="gk-input" type="tel" inputMode="tel" value={phone} disabled={busy} maxLength={24} placeholder="+995 5__ __ __ __" onChange={event => { setPhone(event.target.value); requestId.current = crypto.randomUUID(); }} /><span className="gk-field__hint">{t('To reach you about it, by message. Nothing is published.')}</span></div>
          {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        </div>}
    </Dialog>
  );
}
