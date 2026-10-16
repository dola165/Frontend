import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, CheckCheck, type LucideIcon } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, List, ListRow, Skeleton } from '../../../../design/primitives';
import { Tabs } from '../../../../design/Tabs';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { JourneyReminderActions } from '../../../../features/mapPlanning/JourneyReminderActions';
import { requestDestination, type RequestItem } from '../../../../features/requests/api';
import { requestIcon } from '../../../../features/requests/requestIcon';
import type { NotificationItem } from '../../../../types/notifications';
import { buildNotificationDestination, formatNotificationTime } from '../../../../utils/notifications';
import { useInboxPreview, type InboxCounts } from './useInbox';

type InboxTab = 'needs-you' | 'updates';

const Glyph = ({ icon: Icon }: { icon: LucideIcon }) => <span className="gk-inbox__lead"><Icon aria-hidden="true" /></span>;

/** One Inbox: decisions waiting for the person, then the latest updates, each linking to its full page. */
export function InboxPanel({ counts, titleId, onNavigate }: { counts: InboxCounts; titleId: string; onNavigate: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const preview = useInboxPreview();
    const [tab, setTab] = useState<InboxTab>(counts.needsYou === 0 && (counts.updates ?? 0) > 0 ? 'updates' : 'needs-you');
    const [opening, setOpening] = useState<number | null>(null);
    const tabs = `${titleId}-tab`;
    const partial = counts.needsYouPartial || (preview.decisions.status === 'ready' && preview.decisions.data.partial);

    const openUpdate = async (notification: NotificationItem) => {
        // One press opens it once, even if the first mark-read is still on its way.
        if (opening !== null) return;
        setOpening(notification.id);
        try { await preview.markRead(notification); } finally { setOpening(null); }
        onNavigate();
        navigate(buildNotificationDestination(notification));
    };
    const loading = <div className="gk-pop__loading" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={40} /><Skeleton height={40} /><Skeleton height={40} /></div>;
    const failed = (
        <div className="gk-notice gk-notice--danger" role="alert">
            <span>{copy('This part of your inbox could not load.', 'ეს ნაწილი ვერ ჩაიტვირთა.')}</span>
            <Button size="sm" variant="ghost" onClick={preview.retry}>{copy('Try again', 'ხელახლა')}</Button>
        </div>
    );
    const needsYouCount = counts.needsYou === null ? undefined : partial ? undefined : counts.needsYou;
    const needsYouLabel = partial && counts.needsYou
        ? <>{copy('Needs you', 'გელოდებათ')}<span className="gk-tab__count">{counts.needsYou}+</span></>
        : copy('Needs you', 'გელოდებათ');

    const decisions = () => {
        if (preview.decisions.status !== 'ready') return preview.decisions.status === 'error' ? failed : loading;
        const { items } = preview.decisions.data;
        if (items.length) {
            return (
                <List label={copy('Decisions waiting for you', 'გადაწყვეტილებები')}>
                    {items.map((item: RequestItem) => (
                        <ListRow key={item.key} to={requestDestination(item.destination) ?? '/requests?view=INCOMING'} lead={<Glyph icon={requestIcon(item.family)} />}
                            title={item.title} meta={item.context} />
                    ))}
                </List>
            );
        }
        // The preview reads the latest requests; older ones can still be waiting, and the count says so.
        if (counts.needsYou) {
            return (
                <EmptyNote title={copy(`${counts.needsYou}${partial ? '+' : ''} waiting for you`, `${counts.needsYou}${partial ? '+' : ''} გელოდებათ`)}
                    action={<ButtonLink to="/requests?view=INCOMING" onClick={onNavigate}>{copy('Open requests', 'მოთხოვნების გახსნა')}</ButtonLink>}>
                    {copy('They are further down your requests.', 'ისინი მოთხოვნების სიაშია.')}
                </EmptyNote>
            );
        }
        if (partial || counts.needsYou === null) return null;
        return <EmptyNote title={copy('Nothing needs you right now', 'ახლა არაფერი გელოდებათ')}>{copy('Invitations, applications and approvals that need your decision appear here.', 'მოწვევები და განაცხადები, რომლებიც თქვენს გადაწყვეტილებას საჭიროებს, აქ გამოჩნდება.')}</EmptyNote>;
    };

    return (
        <>
            <div className="gk-pop__head"><h2 id={titleId} className="gk-pop__title">{copy('Inbox', 'შემოსულები')}</h2></div>
            <Tabs<InboxTab> label={copy('Inbox', 'შემოსულები')} value={tab} onChange={setTab} idBase={tabs} items={[
                { id: 'needs-you', label: needsYouLabel, count: needsYouCount },
                { id: 'updates', label: copy('Updates', 'სიახლეები'), count: counts.updates ?? undefined },
            ]} />

            {tab === 'needs-you' && (
                <div role="tabpanel" id={`${tabs}-needs-you-panel`} aria-labelledby={`${tabs}-needs-you`}>
                    {decisions()}
                    {partial && <p className="gk-pop__note" role="status">{copy('Some request types could not load. The Requests page shows what is available.', 'ზოგი მოთხოვნა ვერ ჩაიტვირთა. მოთხოვნების გვერდზე ჩანს ის, რაც ხელმისაწვდომია.')}</p>}
                    {counts.needsYou === null && preview.decisions.status === 'ready' && !preview.decisions.data.items.length && <p className="gk-pop__note" role="status">{copy('Your requests could not be counted. Open Requests to check.', 'მოთხოვნების დათვლა ვერ მოხერხდა. შეამოწმეთ მოთხოვნების გვერდზე.')}</p>}
                    <div className="gk-pop__foot">
                        <Link to="/requests" onClick={onNavigate}>{copy('All requests', 'ყველა მოთხოვნა')}</Link>
                        <Link to="/requests?view=OUTGOING" onClick={onNavigate}>{copy('Sent by you', 'გაგზავნილი')}</Link>
                    </div>
                </div>
            )}

            {tab === 'updates' && (
                <div role="tabpanel" id={`${tabs}-updates-panel`} aria-labelledby={`${tabs}-updates`}>
                    {preview.updates.status === 'loading' && loading}
                    {preview.updates.status === 'error' && failed}
                    {preview.updates.status === 'ready' && (preview.updates.data.length === 0
                        ? <EmptyNote title={copy('No updates yet', 'სიახლეები ჯერ არ არის')}>{copy('News from your clubs, squads and conversations appears here.', 'თქვენი კლუბების და გუნდების სიახლეები აქ გამოჩნდება.')}</EmptyNote>
                        : <ul className="gk-list" aria-label={copy('Latest updates', 'ბოლო სიახლეები')}>
                            {preview.updates.data.map(notification => (
                                <li key={notification.id} className={notification.isRead ? 'gk-inbox__read' : 'gk-inbox__unread'}>
                                    <button type="button" className="gk-list-row" onClick={() => void openUpdate(notification)} aria-busy={opening === notification.id || undefined}
                                        aria-label={`${notification.isRead ? '' : copy('Unread: ', 'წაუკითხავი: ')}${notification.title}`}>
                                        <span className="gk-list-row__lead"><Glyph icon={BellRing} /></span>
                                        <span className="gk-list-row__main"><span className="gk-list-row__title">{notification.title}</span><span className="gk-list-row__meta">{notification.body}</span></span>
                                        <span className="gk-list-row__trail"><span className="gk-inbox__time">{formatNotificationTime(notification.createdAt)}</span></span>
                                    </button>
                                    <JourneyReminderActions notification={notification} />
                                </li>
                            ))}
                        </ul>)}
                    {preview.markAllFailed && <p className="gk-pop__note" role="alert">{copy('Could not mark updates as read. Try again.', 'სიახლეების წაკითხულად მონიშვნა ვერ მოხერხდა. სცადეთ ხელახლა.')}</p>}
                    <div className="gk-pop__foot">
                        <Link to="/notifications" onClick={onNavigate}>{copy('All updates', 'ყველა სიახლე')}</Link>
                        <Button size="sm" variant="ghost" disabled={!counts.updates || preview.busy || preview.updates.status !== 'ready'} aria-busy={preview.busy} onClick={() => void preview.markAllRead()}>
                            <CheckCheck aria-hidden="true" />{copy('Mark all as read', 'ყველა წაკითხულია')}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
