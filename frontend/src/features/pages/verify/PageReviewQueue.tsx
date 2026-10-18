import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink, EmptyNote, List, ListRow } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { decidePageReview, fetchPageReviews, type PageReview, type ReviewReceipt } from '../api';
import { usePagesCopy } from '../copy';
import { UNLOCK_WORDS } from './words';
import './review.css';

export function PageReviewQueue() {
  const { user } = useAuth();
  return <ReviewQueue key={user?.id ?? 'guest'} />;
}
function ReviewQueue() {
  const t = usePagesCopy();
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status: ReviewReceipt['status'] = raw === 'APPROVED' || raw === 'REJECTED' ? raw : 'PENDING';
  const [attempt, setAttempt] = useState(0);
  const key = `${status}:${attempt}`;
  const [read, setRead] = useState<{ key: string; rows: PageReview[]; error: string } | null>(null);
  const current = read?.key === key ? read : null;
  const loading = current === null, rows = current?.rows ?? [], error = current?.error ?? '';
  useEffect(() => {
    const controller = new AbortController();
    fetchPageReviews(status, controller.signal).then(value => { if (!controller.signal.aborted) setRead({ key, rows: value, error: '' }); }).catch(failure => { if (!controller.signal.aborted) setRead({ key, rows: [], error: extractApiErrorMessage(failure, t('Could not load review requests.')) }); });
    return () => controller.abort();
  }, [status, key, t]);
  const selectedId = params.get('review'), selected = rows.find(row => row.id === selectedId);
  return <main className="gk gk-page-review gk-stack">
    <h1>{t('Page reviews')}</h1>
    <div className="gk-row" role="group" aria-label={t('Review status')}>
      {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(value => <Button key={value} aria-pressed={status === value} onClick={() => setParams({ status: value })}>{t(value === 'PENDING' ? 'Pending' : value === 'APPROVED' ? 'Approved' : 'Rejected')}</Button>)}
      <Button onClick={() => setAttempt(value => value + 1)}>{t('Refresh')}</Button>
    </div>
    {loading ? <p role="status">{t('Loading…')}</p> : error ? <EmptyNote title={error} action={<Button onClick={() => setAttempt(value => value + 1)}>{t('Try again')}</Button>} /> : <div className="gk-page-review__columns">
      <div className="gk-page-review__list"><List label={t('Page review requests')}>{rows.map(row => <ListRow key={row.id} title={row.name} meta={t(row.kind === 'CLAIM' ? 'Page claim' : 'Verification')} current={selected?.id === row.id} onClick={() => setParams({ status, review: row.id })} />)}</List>{!rows.length && <p>{t('No review requests in this status.')}</p>}</div>
      {selected ? <ReviewDecision key={selected.id} row={selected} onSaved={saved => { setParams({ status: saved.status, review: saved.id }); setAttempt(value => value + 1); }} /> : selectedId ? <EmptyNote title={t('This request may have changed status.')} action={<ButtonLink to={`/pages/requests/${encodeURIComponent(selectedId)}`}>{t('View request')}</ButtonLink>} /> : <p>{t('Choose a request to view its evidence.')}</p>}
    </div>}
  </main>;
}
function ReviewDecision({ row, onSaved }: { row: PageReview; onSaved: (receipt: ReviewReceipt) => void }) {
  const t = usePagesCopy(), id = useId();
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const command = useRef<{ signature: string; requestId: string } | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const send = async (outcome: 'APPROVED' | 'REJECTED') => {
    if (busy || !reason.trim() || !row.canDecide) return;
    const signature = `${outcome}:${reason.trim()}`;
    if (command.current?.signature !== signature) command.current = { signature, requestId: crypto.randomUUID() };
    setBusy(true); setError('');
    try { const saved = await decidePageReview(row.id, { requestId: command.current.requestId, expectedVersion: row.revision, outcome, reason: reason.trim() }); if (active.current) onSaved(saved); }
    catch (failure) { setError(extractApiErrorMessage(failure, t('Could not save the review. Refresh before retrying a changed request.'))); }
    finally { setBusy(false); }
  };
  return <section className="gk-stack gk-stack--tight" aria-label={t('Request evidence')}>
    <h2>{row.name}</h2><ButtonLink size="sm" to={`/profile/${row.claimantId}`}>{t('View claimant profile')}</ButtonLink><ReviewDetails receipt={row} />
    {row.status === 'PENDING' && <>
      {row.kind === 'CLAIM' && <p>{t('Approving claim evidence keeps existing access. Ownership changes only through an explicit transfer.')}</p>}
      {!row.canApprove && <p>{t('Approval requires an eligible claimant. Verification approval is available for club requests from a current page manager. You cannot review your own request.')}</p>}
      <label className="gk-field__label" htmlFor={id}>{t('Review reason')}</label>
      <textarea id={id} className="gk-input" value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} />
      <div className="gk-row"><Button disabled={busy || !reason.trim() || !row.canApprove || !row.canDecide} onClick={() => void send('APPROVED')}>{t('Approve')}</Button><Button disabled={busy || !reason.trim() || !row.canDecide} onClick={() => void send('REJECTED')}>{t('Reject')}</Button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
export function ReviewDetails({ receipt }: { receipt: ReviewReceipt }) {
  const t = usePagesCopy();
  const valueWords: Record<string, string> = { ...UNLOCK_WORDS, CHAIR: 'I run it', COACH: 'I coach there', ADMIN: 'I do the admin', OTHER: 'Something else' };
  return <div className="gk-stack gk-stack--tight">
    <strong>{t(receipt.status === 'PENDING' ? 'Pending' : receipt.status === 'APPROVED' ? 'Approved' : 'Rejected')}</strong>
    <small>{t('Receipt: {id}', { id: receipt.id })}</small>
    <dl>{Object.entries(receipt.evidence).filter(([, value]) => Boolean(value)).map(([key, value]) => <div key={key}><dt>{t(({ phone: 'Phone', legalName: 'Legal name', registrationNumber: 'Registration number', role: 'Role', action: 'Requested action' } as Record<string, string>)[key] ?? key)}</dt><dd>{(key === 'role' || key === 'action') && value ? t(valueWords[value] ?? value) : value}</dd></div>)}</dl>
    {receipt.reason && <p>{receipt.reason}</p>}
  </div>;
}
