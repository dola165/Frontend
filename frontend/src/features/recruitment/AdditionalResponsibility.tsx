import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { getAuthSessionId, subscribeAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useClubEntryEligibility, useEntryCopy } from '../applications/clubEntry';

export function AdditionalResponsibility({ onChanged }: { onChanged: () => void }) {
  const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  return <AdditionalResponsibilityForm key={sessionId} sessionId={sessionId} onChanged={onChanged} />;
}

function AdditionalResponsibilityForm({ sessionId, onChanged }: { sessionId: AuthSessionId; onChanged: () => void }) {
  const { copy, reason } = useEntryCopy();
  const [clubs, setClubs] = useState<{ clubId: number; clubName: string }[]>([]);
  const [club, setClub] = useState(''), [role, setRole] = useState<'COACH' | 'PLAYER'>('COACH');
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState(false), [retry, setRetry] = useState(0), [busy, setBusy] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const eligibility = useClubEntryEligibility(Number(club), role, 'ADDITIONAL_RESPONSIBILITY', !!club);
  useEffect(() => {
    const request = new AbortController();
    const config: AuthSessionRequestConfig = { _authSessionId: sessionId, signal: request.signal };
    void apiClient.get<typeof clubs>('/me/club-relationships', config)
      .then(response => { if (!request.signal.aborted) { setClubs(response.data); setLoadError(false); } })
      .catch(() => { if (!request.signal.aborted) setLoadError(true); });
    return () => request.abort();
  }, [sessionId, retry]);
  useEffect(() => () => mutation.current?.abort(), []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.current || !eligibility.allowed || !message.trim()) return;
    const request = new AbortController(); mutation.current = request; setBusy(true); setError(''); setNotice('');
    const config: AuthSessionRequestConfig = { _authSessionId: sessionId, signal: request.signal };
    try {
      await apiClient.post(`/clubs/${club}/responsibility-requests`, { role, message: message.trim() }, config);
      if (request.signal.aborted) return;
      setMessage('');
      setNotice(copy('Request sent for club review. Your existing responsibilities remain in place.', 'მოთხოვნა გაიგზავნა კლუბის განსახილველად. არსებული პასუხისმგებლობები უცვლელია.'));
      eligibility.reload(); onChanged(); window.dispatchEvent(new Event('requests-updated'));
    } catch (e) {
      if (!request.signal.aborted) { setError(extractApiErrorMessage(e, copy('Could not submit this request.', 'მოთხოვნა ვერ გაიგზავნა.'))); eligibility.reload(); }
    } finally {
      if (!request.signal.aborted) { mutation.current = null; setBusy(false); }
    }
  };
  if (loadError) return <p role="alert">{copy('Your clubs could not load.', 'კლუბები ვერ ჩაიტვირთა.')} <button type="button" onClick={() => setRetry(n => n + 1)}>{copy('Retry clubs', 'კლუბების ხელახლა ჩატვირთვა')}</button></p>;
  if (!clubs.length) return null;
  return <details className="recruitment-additional"><summary>{copy('Request another responsibility in your club', 'მოითხოვეთ დამატებითი პასუხისმგებლობა თქვენს კლუბში')}</summary>
    <form className="recruitment-form" onSubmit={event => void submit(event)}>
      <p>{copy('Describe the new responsibility. Leadership approval and your acceptance are required; this request grants no access.', 'აღწერეთ ახალი პასუხისმგებლობა. საჭიროა ხელმძღვანელობის თანხმობა და თქვენი დასტური; მოთხოვნა წვდომას არ ანიჭებს.')}</p>
      <label>{copy('Club', 'კლუბი')}<select required disabled={busy} value={club} onChange={e => { setClub(e.target.value); setError(''); setNotice(''); }}><option value="">{copy('Choose club', 'აირჩიეთ კლუბი')}</option>{clubs.map(c => <option key={c.clubId} value={c.clubId}>{c.clubName}</option>)}</select></label>
      <label>{copy('Responsibility', 'პასუხისმგებლობა')}<select disabled={busy} value={role} onChange={e => { setRole(e.target.value as 'COACH' | 'PLAYER'); setError(''); setNotice(''); }}><option value="COACH">{copy('Coaching responsibility', 'მწვრთნელის პასუხისმგებლობა')}</option><option value="PLAYER">{copy('Playing trial', 'მოთამაშის საცდელი პერიოდი')}</option></select></label>
      {eligibility.loading && <p role="status">{copy('Checking current eligibility…', 'მიმდინარე უფლებების შემოწმება…')}</p>}
      {eligibility.error && <p role="alert">{copy('Eligibility could not load.', 'მოთხოვნის უფლება ვერ შემოწმდა.')} <button type="button" onClick={eligibility.reload}>{copy('Retry eligibility', 'ხელახლა შემოწმება')}</button></p>}
      {eligibility.data && !eligibility.allowed && <p role="status">{reason(eligibility.data)} {eligibility.data.reason === 'IDENTITY_REQUIRED'
        ? <Link to="/account/roles">{copy('Review football roles', 'საფეხბურთო როლების ნახვა')}</Link>
        : <Link to="/requests">{copy('Review requests', 'მოთხოვნების ნახვა')}</Link>}</p>}
      <label>{copy('Describe the responsibility', 'აღწერეთ პასუხისმგებლობა')}<textarea required disabled={busy} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} /></label>
      <button type="submit" disabled={busy || !eligibility.allowed || !message.trim()} className="recruitment-primary">{busy ? copy('Sending…', 'იგზავნება…') : copy('Request club approval', 'კლუბის თანხმობის მოთხოვნა')}</button>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    </form>
  </details>;
}
