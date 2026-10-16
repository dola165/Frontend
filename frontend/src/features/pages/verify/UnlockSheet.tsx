import { useId, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { Button } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { requestVerification } from '../api';
import { usePagesCopy } from '../copy';
import { usePageEdit } from '../edit/context';
import { type LockedAction } from '../model/kinds';
import { UNLOCK_WORDS } from './words';
import '../pages.css';

/**
 * Verification is asked only at the moment a locked thing is tried, in one sheet, never up front. Legal name, a
 * registration number if there is one, and a phone to call: about two minutes. Everything else keeps working.
 */
export function UnlockSheet({ action, onClose }: { action: LockedAction; onClose: () => void }) {
  const t = usePagesCopy();
  const { page, replace } = usePageEdit();
  const [legalName, setLegalName] = useState(page?.identity.name ?? '');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [phone, setPhone] = useState(page?.identity.contact.phone ?? page?.suggestions?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  if (!page) return null;
  const requested = page.verification === 'REQUESTED';
  const thing = t(page.kind === 'CLUB' ? 'club' : 'page');
  const send = async () => {
    if (busy || legalName.trim().length < 2 || phone.replace(/\D/g, '').length < 9) return;
    setBusy(true); setError('');
    try { replace(await requestVerification(page.ref, { action, legalName: legalName.trim(), registrationNumber: registrationNumber.trim(), phone: phone.trim() })); }
    catch (failure) { setError(extractApiErrorMessage(failure, t('Could not send. Try again.'))); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open size="sm" title={requested ? t('Verification requested') : t('To {do}, verify your {thing}', { do: t(UNLOCK_WORDS[action]), thing })} description={requested ? undefined : t('About 2 minutes, so nobody can take money in your name. Everything else on your page keeps working meanwhile.')} onClose={onClose} closeLabel={t('Not now')}
      footer={requested ? <Button variant="primary" onClick={onClose}>{t('Done')}</Button> : <><Button variant="ghost" onClick={onClose}>{t('Not now')}</Button><Button variant="primary" disabled={busy || legalName.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={() => void send()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{t('Send')}</Button></>}>
      {requested
        ? <p className="gk-row"><ShieldCheck aria-hidden="true" size={16} />{t('We check your details and reply by message to {phone}, usually within a day. Until then, {do} stays locked; everything else works.', { phone: phone || t('you'), do: t(UNLOCK_WORDS[action]) })}</p>
        : <div className="gk-boxedit">
          <div><label className="gk-field__label" htmlFor={`${id}-legal`}>{t('Legal name')}</label><input id={`${id}-legal`} className="gk-input" autoFocus value={legalName} maxLength={160} onChange={event => setLegalName(event.target.value)} /><span className="gk-field__hint">{t('As registered, or your own name for an informal club.')}</span></div>
          <div><label className="gk-field__label" htmlFor={`${id}-reg`}>{t('Registration number')}</label><input id={`${id}-reg`} className="gk-input" value={registrationNumber} maxLength={40} placeholder={t('If there is one')} onChange={event => setRegistrationNumber(event.target.value)} /></div>
          <div><label className="gk-field__label" htmlFor={`${id}-phone`}>{t('Phone')}</label><input id={`${id}-phone`} className="gk-input" type="tel" inputMode="tel" value={phone} maxLength={24} placeholder="+995 5__ __ __ __" onChange={event => setPhone(event.target.value)} /><span className="gk-field__hint">{t('To reach you about it, by message. Nothing is published.')}</span></div>
          {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        </div>}
    </Dialog>
  );
}
