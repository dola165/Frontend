import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Button, EmptyNote } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchPageReviewReceipt } from '../api';
import { usePagesCopy } from '../copy';
import { ReviewDetails } from './PageReviewQueue';
import './review.css';

export function PageReviewReceipt() {
  const { reviewId = '' } = useParams<{ reviewId: string }>();
  const { user } = useAuth();
  return <Receipt key={`${user?.id ?? 'guest'}:${reviewId}`} id={reviewId} />;
}
function Receipt({ id }: { id: string }) {
  const t = usePagesCopy();
  const [attempt, setAttempt] = useState(0), [read, setRead] = useState<{ key: string; receipt: Awaited<ReturnType<typeof fetchPageReviewReceipt>> | null; error: string } | null>(null);
  const key = `${id}:${attempt}`, receipt = read?.key === key ? read.receipt : null, error = read?.key === key ? read.error : '';
  useEffect(() => {
    const controller = new AbortController();
    fetchPageReviewReceipt(id, controller.signal).then(value => { if (!controller.signal.aborted) setRead({ key, receipt: value, error: '' }); }).catch(failure => { if (!controller.signal.aborted) setRead({ key, receipt: null, error: extractApiErrorMessage(failure, t('Could not load this request.')) }); });
    return () => controller.abort();
  }, [id, key, t]);
  return <main className="gk gk-page-review gk-stack"><h1>{t('Your page request')}</h1>
    {error ? <EmptyNote title={error} action={<Button onClick={() => setAttempt(value => value + 1)}>{t('Try again')}</Button>} /> : receipt ? <><ReviewDetails receipt={receipt} /><Button onClick={() => setAttempt(value => value + 1)}>{t('Refresh')}</Button></> : <p role="status">{t('Loading…')}</p>}
  </main>;
}
