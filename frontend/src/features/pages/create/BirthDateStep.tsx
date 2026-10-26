import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Dialog } from '../../../design/Dialog';
import { Button, Field } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { todayIso } from '../../../utils/age';
import { saveBirthDate } from '../../profiles/api';
import { usePagesCopy } from '../copy';

/**
 * Pages are for adults, and an account without a birth date is not counted as one: before the create sheet, it is
 * asked for the date once. Saving refreshes the account; the host then shows the sheet or "Pages are for adults".
 */
export function BirthDateStep({ onClose }: { onClose: () => void }) {
  const t = usePagesCopy();
  const { bootstrapSession } = useAuth();
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!dob || dob > todayIso() || busy) { setError(t('Enter your date of birth.')); return; }
    setBusy(true); setError('');
    try { await saveBirthDate(dob); await bootstrapSession(); }
    catch (failure) { setError(extractApiErrorMessage(failure, t('Not saved. Check your connection and try again.'))); }
    finally { setBusy(false); }
  };
  return <Dialog open size="sm" title={t('Your date of birth')} description={t('Pages are for adults, so we ask once.')} onClose={onClose}
    footer={<>
      <Button variant="ghost" onClick={onClose}>{t('Close')}</Button>
      <Button variant="primary" disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="gk-spin" aria-hidden="true" />}{t('Continue')}</Button>
    </>}>
    <Field label={t('Date of birth')} htmlFor="page-birth-date" error={error || undefined}>
      <input id="page-birth-date" className="gk-input" type="date" max={todayIso()} value={dob} autoComplete="bday" onChange={event => { setDob(event.target.value); setError(''); }} />
    </Field>
  </Dialog>;
}
