import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { fetchNotificationPreferences, setNotificationGroup, type NotificationGroupKey, type NotificationPreferences } from '../../api/notificationPreferences';
import { usePushDevice } from '../../features/notifications/pushSubscription';
import './turn-on-notifications.css';

const dismissedKey = (group: NotificationGroupKey) => `gk.notifications.prompt.${group}.dismissed`;
const readDismissed = (group: NotificationGroupKey) => { try { return localStorage.getItem(dismissedKey(group)) === '1'; } catch { return false; } };
const writeDismissed = (group: NotificationGroupKey) => { try { localStorage.setItem(dismissedKey(group), '1'); } catch { /* private window */ } };

/**
 * One line, one tap: turns on push for a group (Team work by default) on this device. Shows only
 * while it would change something: push possible here, not yet on for this device and group, not
 * dismissed. On an iPhone that is not on the Home Screen it says what to do instead. Mount it
 * anywhere with `<TurnOnNotificationsPrompt />`; the Team work page is the first place.
 */
export function TurnOnNotificationsPrompt({ group = 'TEAM_WORK', className }: { group?: NotificationGroupKey; className?: string }) {
    const copy = useJourneyCopy();
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [dismissed, setDismissed] = useState(() => readDismissed(group));
    const [done, setDone] = useState(false);
    const onPreferences = useCallback((next: NotificationPreferences) => setPreferences(next), []);
    const device = usePushDevice(preferences?.pushPublicKey, onPreferences);

    useEffect(() => {
        if (dismissed) return;
        const controller = new AbortController();
        fetchNotificationPreferences(controller.signal).then(setPreferences).catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
        return () => controller.abort();
    }, [dismissed]);

    const choice = preferences?.groups.find(item => item.key === group);
    const groupOn = choice?.push === true;
    if (dismissed || unavailable || !preferences || !choice || !preferences.pushConfigured) return null;
    if (device.state === 'checking' || device.state === 'unsupported' || device.state === 'denied') return null;
    if (device.state === 'on' && groupOn && !done) return null;

    const groupName = group === 'TEAM_WORK' ? copy('Team work', 'გუნდის საქმე') : copy('these', 'ამ');
    const dismiss = () => { writeDismissed(group); setDismissed(true); };
    const turnOn = async () => {
        if (!groupOn) setPreferences(await setNotificationGroup(group, { push: true, language: device.language }));
        const outcome = await device.enable();
        if (outcome.ok) setDone(true);
    };

    return (
        <div className={`gk-turn-on-notifications ${className ?? ''}`} role="status" data-testid="turn-on-notifications">
            <BellRing aria-hidden className="gk-turn-on-notifications__icon" />
            {done ? (
                <p className="gk-turn-on-notifications__text">{copy('Notifications are on for this device. Change what you get in', 'შეტყობინებები ამ მოწყობილობაზე ჩართულია. რას მიიღებთ, შეცვალეთ აქ:')} <Link to="/account?tab=notifications">{copy('Notification settings', 'შეტყობინებების პარამეტრები')}</Link>.</p>
            ) : device.state === 'needs-home-screen' ? (
                <p className="gk-turn-on-notifications__text">{copy('To get Team work notifications on this iPhone, add GrassKickZ to your Home Screen (Share → Add to Home Screen) and open it from there.', 'რომ ამ iPhone-ზე გუნდის საქმის შეტყობინებები მიიღოთ, დაამატეთ GrassKickZ მთავარ ეკრანზე (გაზიარება → მთავარ ეკრანზე დამატება) და იქიდან გახსენით.')}</p>
            ) : (
                <>
                    <p className="gk-turn-on-notifications__text">{copy(`Get a ping when something in ${groupName} needs you, even when the site is closed.`, `მიიღეთ შეტყობინება, როცა ${groupName}ში რამე გელოდებათ, საიტი დახურულიც რომ იყოს.`)}</p>
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
