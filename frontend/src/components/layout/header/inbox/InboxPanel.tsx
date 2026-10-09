import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Building2, CalendarDays, CheckCheck, ClipboardCheck, Flag, Goal, HeartHandshake, Trophy, UserPlus, type LucideIcon } from 'lucide-react';
import { Button, EmptyNote, List, ListRow, Skeleton } from '../../../../design/primitives';
import { Tabs } from '../../../../design/Tabs';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { JourneyReminderActions } from '../../../../features/mapPlanning/JourneyReminderActions';
import { requestDestination, type RequestItem } from '../../../../features/requests/api';
import type { NotificationItem } from '../../../../types/notifications';
import { buildNotificationDestination, formatNotificationTime } from '../../../../utils/notifications';
import { useInboxPreview, type InboxCounts } from './useInbox';

type InboxTab = 'needs-you' | 'updates';

function requestIcon(family: string): LucideIcon {
    if (family.includes('TOURNAMENT')) return Trophy;
    if (family.includes('REFEREE') || family.includes('OFFICIAL')) return Flag;
    if (family.includes('FAMILY') || family.includes('GUARDIAN') || family.includes('CONSENT')) return HeartHandshake;
    if (family.includes('BOOKING') || family.includes('VENUE')) return CalendarDays;
    if (family.includes('MATCH')) return Goal;
    if (family.includes('TRYOUT') || family.includes('APPLICATION')) return ClipboardCheck;
    if (family.includes('INVIT')) return UserPlus;
    if (family.includes('CLUB') || family.includes('STAFF')) return Building2;
    return ClipboardCheck;
}

const Glyph = ({ icon: Icon }: { icon: LucideIcon }) => <span className="gk-inbox__lead"><Icon aria-hidden="true" /></span>;

const Loading = () => <div className="gk-pop__loading" role="status" aria-label="Loading"><Skeleton height={40} /><Skeleton height={40} /><Skeleton height={40} /></div>;

/** One Inbox: decisions waiting for the person, then the latest updates, each linking to its full page. */
export function InboxPanel({ counts, titleId, onNavigate }: { counts: InboxCounts; titleId: string; onNavigate: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const preview = useInboxPreview();
    const [tab, setTab] = useState<InboxTab>(counts.needsYou === 0 && (counts.updates ?? 0) > 0 ? 'updates' : 'needs-you');

    const openUpdate = async (notification: NotificationItem) => {
        await preview.markRead(notification);
        onNavigate();
        navigate(buildNotificationDestination(notification));
    };
    const failed = (retryLabel: string) => (
        <div className="gk-notice gk-notice--danger" role="alert">
            <span>{copy('This part of your inbox could not load.', 'ეს ნაწილი ვერ ჩაიტვირთა.')}</span>
            <Button size="sm" variant="ghost" onClick={preview.retry}>{retryLabel}</Button>
        </div>
    );

    return (
        <>
            <div className="gk-pop__head"><h2 id={titleId} className="gk-pop__title">{copy('Inbox', 'შემოსულები')}</h2></div>
            <Tabs<InboxTab> label={copy('Inbox', 'შემოსულები')} value={tab} onChange={setTab} items={[
                { id: 'needs-you', label: copy('Needs you', 'თქვენგან'), count: counts.needsYou ?? undefined },
                { id: 'updates', label: copy('Updates', 'სიახლეები'), count: counts.updates ?? undefined },
            ]} />

            {tab === 'needs-you' && (
                <div role="tabpanel" aria-label={copy('Needs you', 'თქვენგან')}>
                    {preview.decisions.status === 'loading' && <Loading />}
                    {preview.decisions.status === 'error' && failed(copy('Try again', 'ხელახლა'))}
                    {preview.decisions.status === 'ready' && (preview.decisions.data.items.length === 0
                        ? <EmptyNote title={copy('Nothing needs you right now', 'ახლა არაფერი გელოდებათ')}>{copy('Invitations, applications and approvals that need your decision appear here.', 'მოწვევები და განაცხადები, რომლებიც თქვენს გადაწყვეტილებას საჭიროებს, აქ გამოჩნდება.')}</EmptyNote>
                        : <List label={copy('Decisions waiting for you', 'გადაწყვეტილებები')}>
                            {preview.decisions.data.items.map((item: RequestItem) => (
                                <ListRow key={item.key} to={requestDestination(item.destination) ?? '/requests?view=INCOMING'} lead={<Glyph icon={requestIcon(item.family)} />}
                                    title={item.title} meta={item.context} />
                            ))}
                        </List>)}
                    {preview.decisions.status === 'ready' && preview.decisions.data.partial && <p className="gk-pop__note">{copy('Some request types could not load. The Requests page shows what is available.', 'ზოგი მოთხოვნა ვერ ჩაიტვირთა.')}</p>}
                    <div className="gk-pop__foot">
                        <Link to="/requests" onClick={onNavigate}>{copy('All requests', 'ყველა მოთხოვნა')}</Link>
                        <Link to="/requests?view=OUTGOING" onClick={onNavigate}>{copy('Sent by you', 'გაგზავნილი')}</Link>
                    </div>
                </div>
            )}

            {tab === 'updates' && (
                <div role="tabpanel" aria-label={copy('Updates', 'სიახლეები')}>
                    {preview.updates.status === 'loading' && <Loading />}
                    {preview.updates.status === 'error' && failed(copy('Try again', 'ხელახლა'))}
                    {preview.updates.status === 'ready' && (preview.updates.data.length === 0
                        ? <EmptyNote title={copy('No updates yet', 'სიახლეები ჯერ არ არის')}>{copy('News from your clubs, squads and conversations appears here.', 'თქვენი კლუბების და გუნდების სიახლეები აქ გამოჩნდება.')}</EmptyNote>
                        : <ul className="gk-list" aria-label={copy('Latest updates', 'ბოლო სიახლეები')}>
                            {preview.updates.data.map(notification => (
                                <li key={notification.id} className={notification.isRead ? 'gk-inbox__read' : 'gk-inbox__unread'}>
                                    <button type="button" className="gk-list-row" onClick={() => void openUpdate(notification)}
                                        aria-label={`${notification.isRead ? '' : copy('Unread: ', 'წაუკითხავი: ')}${notification.title}`}>
                                        <span className="gk-list-row__lead"><Glyph icon={BellRing} /></span>
                                        <span className="gk-list-row__main"><span className="gk-list-row__title">{notification.title}</span><span className="gk-list-row__meta">{notification.body}</span></span>
                                        <span className="gk-list-row__trail"><span className="gk-inbox__time">{formatNotificationTime(notification.createdAt)}</span></span>
                                    </button>
                                    <JourneyReminderActions notification={notification} />
                                </li>
                            ))}
                        </ul>)}
                    {preview.error && <p className="gk-pop__note" role="alert">{preview.error}</p>}
                    <div className="gk-pop__foot">
                        <Link to="/notifications" onClick={onNavigate}>{copy('All updates', 'ყველა სიახლე')}</Link>
                        <Button size="sm" variant="ghost" disabled={!counts.updates || preview.busy || preview.updates.status !== 'ready'} aria-busy={preview.busy} onClick={() => void preview.markAllRead()}>
                            <CheckCheck />{copy('Mark all as read', 'ყველა წაკითხულია')}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
