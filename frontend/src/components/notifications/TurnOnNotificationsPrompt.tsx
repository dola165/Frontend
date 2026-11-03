import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { fetchNotificationPreferences, turnOnNeededNotifications, type NotificationPreferences } from '../../api/notificationPreferences';
import { usePushDevice } from '../../features/notifications/pushSubscription';
import { EmailNoticeLine } from '../../features/notifications/EmailNoticeLine';
import './turn-on-notifications.css';

const DISMISSED = 'gk.notifications.prompt.dismissed';
const HOME_SCREEN_SHOWN = 'gk.notifications.prompt.homeScreenShown';
const read = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const write = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* private window */ } };

/**
 * One line, one press (step 2, M6): turns on every kind of news this person's links need (the server's `needed`:
 * a parent's family, squad, match and club news; a coach's or player's squad, match and club news; Team work for the
 * team) by push and email, and subscribes this device. Offered only to people with such links, and only while it
 * would change something. On an iPhone not yet on the Home Screen it explains Add to Home Screen, once. Mount it
 * anywhere with `<TurnOnNotificationsPrompt />`; `reason` says what the pings are for on that page.
 */
export function TurnOnNotificationsPrompt({ reason, className }: { reason?: string; className?: string }) {
    const copy = useJourneyCopy();
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [dismissed, setDismissed] = useState(() => read(DISMISSED));
    const [homeScreenShown] = useState(() => read(HOME_SCREEN_SHOWN));
    const [done, setDone] = useState(false);
    const onPreferences = useCallback((next: NotificationPreferences) => setPreferences(next), []);
    const device = usePushDevice(preferences?.pushPublicKey, onPreferences);

    useEffect(() => {
        if (dismissed) return;
        const controller = new AbortController();
        fetchNotificationPreferences(controller.signal).then(setPreferences).catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
        return () => { controller.abort(); };
    }, [dismissed]);

    const needed = preferences?.needed ?? [];
    const neededOn = needed.every(key => preferences?.groups?.some(group => group.key === key && group.push));
    const offered = needed.some(key => key !== 'MESSAGES');
    const homeScreen = device.state === 'needs-home-screen';
    useEffect(() => { if (homeScreen && offered && !dismissed) write(HOME_SCREEN_SHOWN); }, [dismissed, homeScreen, offered]);

    if (dismissed || unavailable || !preferences || !offered || !preferences.pushConfigured) return null;
    // A browser that already blocks notifications is not asked; one that just refused hears why, here.
    if (device.state === 'checking' || device.state === 'unsupported' || (device.state === 'denied' && !device.failure)) return null;
    if (homeScreen && homeScreenShown) return null;
    if (device.state === 'on' && neededOn && !done) return null;

    const ping = reason ?? copy('Get a ping when a session moves, a match changes or something needs you, even when the site is closed.', 'მიიღეთ შეტყობინება, როცა ვარჯიში გადაიწევს, მატჩი შეიცვლება ან რამე გელოდებათ, საიტი დახურულიც რომ იყოს.');
    const dismiss = () => { write(DISMISSED); setDismissed(true); };
    const turnOn = async () => {
        if (!neededOn) setPreferences(await turnOnNeededNotifications(device.language));
        const outcome = device.state === 'on' ? { ok: true } : await device.enable();
        if (outcome.ok) setDone(true);
    };

    return (
        <div className={`gk-turn-on-notifications ${className ?? ''}`} role="status" data-testid="turn-on-notifications">
            <BellRing aria-hidden className="gk-turn-on-notifications__icon" />
            {done ? (
                <div className="gk-turn-on-notifications__text">
                    <p>{copy('Notifications are on. Change what you get in', 'შეტყობინებები ჩართულია. რას მიიღებთ, შეცვალეთ აქ:')} <Link to="/account?tab=notifications">{copy('Notification settings', 'შეტყობინებების პარამეტრები')}</Link>.</p>
                    <EmailNoticeLine email={preferences.email} verified={preferences.emailVerified} unsubscribed={preferences.emailUnsubscribed} />
                </div>
            ) : homeScreen ? (
                <p className="gk-turn-on-notifications__text">{copy('To get notifications on this iPhone, add GrassKickZ to your Home Screen (Share → Add to Home Screen) and open it from there.', 'რომ ამ iPhone-ზე შეტყობინებები მიიღოთ, დაამატეთ GrassKickZ მთავარ ეკრანზე (გაზიარება → მთავარ ეკრანზე დამატება) და იქიდან გახსენით.')}</p>
            ) : (
                <>
                    <p className="gk-turn-on-notifications__text">{ping}</p>
                    <button type="button" className="gk-turn-on-notifications__button" disabled={device.busy} onClick={() => void turnOn()}>{copy('Turn on notifications', 'შეტყობინებების ჩართვა')}</button>
                    <Link className="gk-turn-on-notifications__more" to="/account?tab=notifications">{copy('More choices', 'სხვა არჩევანი')}</Link>
                    {device.failure && <p className="gk-turn-on-notifications__error" role="alert">{device.failure === 'denied'
                        ? copy('This browser blocks notifications for GrassKickZ. Allow them in the address bar, then try again.', 'ეს ბრაუზერი GrassKickZ-ის შეტყობინებებს ბლოკავს. დაუშვით მისამართის ზოლში და სცადეთ ისევ.')
                        : copy('That did not work. Try again in a moment.', 'ვერ მოხერხდა. სცადეთ ცოტა ხანში.')}</p>}
                </>
            )}
            <button type="button" className="gk-turn-on-notifications__close" aria-label={copy('Not now', 'ახლა არა')} onClick={dismiss}><X aria-hidden className="gk-turn-on-notifications__icon" /></button>
        </div>
    );
}
