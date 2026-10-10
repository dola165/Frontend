import './announcements.css';
import { Link } from 'react-router-dom';
import { Check, Megaphone } from 'lucide-react';
import { Badge, Button, Section } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { formatNotificationTime } from '../../utils/notifications';
import { ReadReceipts } from './ReadReceipts';
import { dayText } from './pinning';
import type { HomeAnnouncementsState, PinnedAnnouncement } from './useHomeAnnouncements';

const SHOWN = 3;
const link = (item: PinnedAnnouncement) => `/squads/${item.squad.id}#squad-update-${item.message.id}`;

/**
 * Pinned announcements from my squads at the top of Home. Players and parents read them here and mark
 * them as read; announcements I posted show only who has read them. Hidden when nothing is pinned.
 */
export function HomeAnnouncements({ pinned }: { pinned: HomeAnnouncementsState }) {
    const { user } = useAuth();
    // While loading, nothing is reserved: the block may move above "This week" once it knows who posted.
    if (pinned.loading) return null;
    if (pinned.error) return <p className="gk-notice gk-notice--danger" role="alert">{pinned.error} <Button size="sm" onClick={pinned.retry}>Try again</Button></p>;
    if (!pinned.items.length) return null;
    // Announcements for me come first; my own follow, newest first in each group.
    const ordered = [...pinned.items].sort((a, b) => Number(a.message.author_id === user?.id) - Number(b.message.author_id === user?.id));
    const shown = ordered.slice(0, SHOWN);
    const unread = pinned.items.filter(item => item.message.acknowledgement_requested && !item.message.acknowledged_at).length;
    const onlyMine = pinned.items.every(item => item.message.author_id === user?.id);
    return (
        <Section title="Announcements" id="home-announcements" hint={unread ? `${unread} to read` : onlyMine ? 'Yours, pinned for families' : 'Pinned by your coaches'}>
            <ul className="gk-home-announce" aria-label="Pinned announcements">
                {shown.map(item => {
                    const { squad, message: m } = item;
                    const until = `Pinned until ${dayText(pinned.until(item))}`;
                    if (m.author_id === user?.id) return (
                        <li key={m.id} className="gk-home-announce__item gk-home-announce__item--own">
                            <span className="gk-home-announce__icon" aria-hidden="true"><Megaphone /></span>
                            <div className="gk-home-announce__main">
                                <p className="gk-home-announce__meta"><span className="gk-home-announce__squad">{squad.name}</span><span>You · {formatNotificationTime(m.created_at)}</span><span>{until}</span></p>
                                <Link className="gk-home-announce__title" to={link(item)}>{m.title || 'Announcement'}</Link>
                                {m.important ? <ReadReceipts squadId={squad.id} message={m} compact /> : <span className="gk-home-announce__note">Read receipts were not requested</span>}
                            </div>
                        </li>
                    );
                    const toRead = m.acknowledgement_requested && !m.acknowledged_at;
                    return (
                        <li key={m.id} className="gk-home-announce__item" data-unread={toRead || undefined}>
                            <span className="gk-home-announce__icon" aria-hidden="true"><Megaphone /></span>
                            <div className="gk-home-announce__main">
                                <p className="gk-home-announce__meta"><span className="gk-home-announce__squad">{squad.name}</span><span>{m.author_name} · {formatNotificationTime(m.created_at)}</span><span>{until}</span></p>
                                <Link className="gk-home-announce__title" to={link(item)}>{m.title || 'Announcement'}</Link>
                                <p className="gk-home-announce__body">{m.body}</p>
                                {pinned.failed?.id === m.id && <p className="gk-field__error" role="alert">{pinned.failed.message}</p>}
                            </div>
                            <div className="gk-home-announce__trail">
                                {toRead ? <Button size="sm" variant="primary" disabled={pinned.busy !== null} onClick={() => void pinned.markRead(item)}><Check aria-hidden="true" />{pinned.busy === m.id ? 'Saving…' : 'Mark as read'}</Button>
                                    : m.acknowledgement_requested && m.acknowledged_at ? <Badge tone="accent">Read</Badge> : null}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {pinned.items.length > SHOWN && <Link className="gk-home-announce__more" to="/squads">{pinned.items.length - SHOWN} more pinned in your squads</Link>}
        </Section>
    );
}
