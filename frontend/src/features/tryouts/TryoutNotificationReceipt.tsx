import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { MyTryoutApplication } from '../../api/tryouts';
import type { NotificationItem } from '../../types/notifications';
import { safeNotificationLink } from '../../utils/notificationDestinations';
import { postingLabel, useTryoutCopy } from './tryoutCopy';

export function TryoutNotificationReceipt({ notification }: { notification: NotificationItem }) {
  const { sessionId, user } = useAuth();
  return <Receipt key={`${sessionId}:${user?.id}:${notification.id}`} notification={notification} />;
}
function Receipt({ notification }: { notification: NotificationItem }) {
  const { sessionId } = useAuth();
  const copy = useTryoutCopy();
  const [application, setApplication] = useState<MyTryoutApplication | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const clubLink = safeNotificationLink(notification.linkPath);
  const staff = notification.scope === 'CLUB' && clubLink?.pathname === `/clubs/${notification.clubId}/workspace`
    && clubLink.searchParams.get('tab') === 'tryouts' && clubLink.searchParams.get('applicationId') === String(notification.entityId);
  useEffect(() => {
    if (staff) return;
    const request = new AbortController();
    void apiClient.get<MyTryoutApplication[]>('/tryouts/my-applications', { signal: request.signal, _authSessionId: sessionId } as AuthSessionRequestConfig)
      .then(result => { if (!request.signal.aborted) { setApplication(result.data.find(row => String(row.id) === String(notification.entityId)) || null); setFailed(false); } })
      .catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [notification.entityId, retry, sessionId, staff]);
  if (staff && clubLink) return <Link className="app-text-action" to={clubLink.pathname + clubLink.search}>{copy('Review current club application', 'კლუბის მიმდინარე განაცხადის ნახვა')}</Link>;
  if (application) return <p>{postingLabel(application.status, copy)} · <Link className="app-text-action" to={`/tryouts/${application.tryoutId}`}>{copy('View current application', 'მიმდინარე განაცხადის ნახვა')}</Link></p>;
  return <p><Link className="app-text-action" to="/requests?view=HISTORY">{copy('Open requests and history', 'მოთხოვნებისა და ისტორიის ნახვა')}</Link>{failed && <button type="button" className="ml-2 app-text-action" onClick={() => setRetry(n => n + 1)}>{copy('Retry current status', 'სტატუსის ხელახლა შემოწმება')}</button>}</p>;
}
