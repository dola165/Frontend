import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, Loader2, MonitorSmartphone, Send, Trash2 } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { Section } from '../profiles/account/AccountFields';
import { btnPrimaryClass, btnSecondaryClass, fmt, inputClass, insetClass, labelClass } from '../profiles/account/accountModel';
import { extractApiErrorMessage } from '../../utils/apiError';
import {
    fetchNotificationPreferences, removePushDevice, saveNotificationPreferences, sendTestNotification,
    type NotificationGroupChoice, type NotificationGroupKey, type NotificationPreferences, type NotificationTestResult,
} from '../../api/notificationPreferences';
import { usePushDevice } from './pushSubscription';

type Draft = Pick<NotificationPreferences, 'groups' | 'quietFrom' | 'quietUntil' | 'digestTime'> & { quiet: boolean };

const draftOf = (p: NotificationPreferences): Draft => ({ groups: p.groups, quietFrom: p.quietFrom ?? '22:00', quietUntil: p.quietUntil ?? '08:00', digestTime: p.digestTime, quiet: p.quietFrom != null });
const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tbilisi'; } catch { return 'Asia/Tbilisi'; } };

/**
 * Account → Notifications: push on this device, what to get by push and by email per group,
 * quiet hours and the daily summary time, the devices that get pushes, and a test button.
 * Everything is off until the person turns it on; the bell in the app is never affected.
 */
export const AccountNotificationsTab = () => {
    const copy = useJourneyCopy();
    const [searchParams] = useSearchParams();
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [test, setTest] = useState<{ busy: boolean; result?: NotificationTestResult; error?: string }>({ busy: false });
    const onPreferences = useCallback((next: NotificationPreferences) => setPreferences(next), []);
    const device = usePushDevice(preferences?.pushPublicKey, onPreferences);

    useEffect(() => {
        const controller = new AbortController();
        fetchNotificationPreferences(controller.signal)
            .then(next => { setPreferences(next); setDraft(draftOf(next)); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('Notification settings could not load.', 'შეტყობინებების პარამეტრები ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    // The copy function changes with the language only; loading once is right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const groupWords = useMemo<Record<NotificationGroupKey, { name: string; hint: string }>>(() => ({
        TEAM_WORK: { name: copy('Team work', 'გუნდის საქმე'), hint: copy('Something needs your look, a question for you, a comment on your note, a mention.', 'რამე თქვენს ყურადღებას ელოდება, კითხვა თქვენთვის, კომენტარი თქვენს ჩანაწერზე, მოხსენიება.') },
        MESSAGES: { name: copy('Messages', 'შეტყობინებები'), hint: copy('New chat messages. The ping says only that there is one; the words stay in the app.', 'ახალი მიმოწერა. შეტყობინება მხოლოდ ამბობს, რომ არის; ტექსტი აპში რჩება.') },
        CLUB: { name: copy('Club', 'კლუბი'), hint: copy('Invitations, applications, roles, squads, tryouts.', 'მოწვევები, განაცხადები, როლები, გუნდები, გასინჯვები.') },
        FAMILY: { name: copy('Family', 'ოჯახი'), hint: copy('Children, guardians and consent. Pings never carry the details.', 'შვილები, მეურვეები და თანხმობა. შეტყობინებებს დეტალები არ მოჰყვება.') },
        MATCHES: { name: copy('Matches and schedule', 'მატჩები და განრიგი'), hint: copy('Fixtures, challenges, tournaments, changes and cancellations.', 'მატჩები, გამოწვევები, ტურნირები, ცვლილებები და გაუქმებები.') },
        OTHER: { name: copy('Everything else', 'ყველაფერი სხვა'), hint: copy('Anything not listed above.', 'ყველაფერი, რაც ზემოთ არ არის.') },
    }), [copy]);

    const unsubscribedParam = searchParams.get('unsubscribed');
    if (error && !preferences) {
        return <div role="alert" className="rounded-xl border border-[color:var(--fc-state-danger)]/30 bg-[color:var(--fc-state-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--fc-state-danger)]">{error}</div>;
    }
    if (!preferences || !draft) {
        return <div role="status" aria-label={copy('Loading notification settings…', 'შეტყობინებების პარამეტრები იტვირთება…')} className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[color:var(--fc-accent)]" /></div>;
    }

    const setGroup = (key: NotificationGroupKey, change: Partial<NotificationGroupChoice>) =>
        setDraft(current => current && { ...current, groups: current.groups.map(group => group.key === key ? { ...group, ...change } : group) });
    const dirty = JSON.stringify(draftOf(preferences)) !== JSON.stringify(draft);

    const save = async (extra: { emailUnsubscribed?: boolean } = {}) => {
        setSaving(true); setError(null); setSaved(false);
        try {
            const next = await saveNotificationPreferences({
                language: device.language, timeZone: browserZone(), groups: draft.groups, digestTime: draft.digestTime,
                quietFrom: draft.quiet ? draft.quietFrom : null, quietUntil: draft.quiet ? draft.quietUntil : null, ...extra,
            });
            setPreferences(next); setDraft(draftOf(next)); setSaved(true);
        } catch (failure) {
            setError(extractApiErrorMessage(failure, copy('That could not be saved. Your changes are still here.', 'ვერ შეინახა. თქვენი ცვლილებები შენარჩუნებულია.')));
        } finally { setSaving(false); }
    };

    const runTest = async () => {
        setTest({ busy: true });
        try { setTest({ busy: false, result: await sendTestNotification(device.language) }); }
        catch (failure) { setTest({ busy: false, error: extractApiErrorMessage(failure, copy('The test could not be sent.', 'ტესტი ვერ გაიგზავნა.')) }); }
    };

    const removeDevice = async (id: number) => {
        try { setPreferences(await removePushDevice(id)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That device could not be removed.', 'მოწყობილობა ვერ წაიშალა.'))); }
    };

    const anyPush = draft.groups.some(group => group.push);
    const dryRun = preferences.mode !== 'LIVE';

    return (
        <div className="space-y-5">
            {unsubscribedParam === '1' && <p role="status" className="rounded-xl border border-[color:var(--fc-accent-border)] bg-[color:var(--fc-accent-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--fc-accent)]">{copy('Email notifications are now off. You can turn them back on below.', 'ელფოსტის შეტყობინებები გამორთულია. ქვემოთ შეგიძლიათ ისევ ჩართოთ.')}</p>}
            {unsubscribedParam === 'invalid' && <p role="alert" className="rounded-xl border border-[color:var(--fc-state-danger)]/30 bg-[color:var(--fc-state-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--fc-state-danger)]">{copy('That unsubscribe link was not valid. Email can be turned off below.', 'გამორთვის ბმული არასწორია. ელფოსტა ქვემოთ შეგიძლიათ გამორთოთ.')}</p>}
            {error && <p role="alert" className="rounded-xl border border-[color:var(--fc-state-danger)]/30 bg-[color:var(--fc-state-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--fc-state-danger)]">{error}</p>}
            {dryRun && <p className="text-sm text-[color:var(--fc-text-secondary)]">{preferences.mode === 'OFF'
                ? copy('Delivery outside the app is switched off on this server.', 'აპის გარეთ მიწოდება ამ სერვერზე გამორთულია.')
                : copy('This server is in dry-run: it records what it would send and sends nothing.', 'ეს სერვერი სატესტო რეჟიმშია: იწერს, რას გააგზავნიდა, და არაფერს აგზავნის.')}</p>}

            <Section title={copy('On this device', 'ამ მოწყობილობაზე')} description={copy('Pushes reach this browser even when GrassKickZ is closed. Desktop and Android work as they are.', 'შეტყობინებები ამ ბრაუზერში მაშინაც მოდის, როცა GrassKickZ დახურულია. კომპიუტერი და Android ისედაც მუშაობს.')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <BellRing aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--fc-accent)]" />
                        <p className="text-sm leading-6 text-[color:var(--fc-text-primary)]">
                            {!preferences.pushConfigured ? copy('Push is not set up on this server yet.', 'ამ სერვერზე push ჯერ არ არის გამართული.')
                                : device.state === 'checking' ? copy('Checking this browser…', 'ბრაუზერი მოწმდება…')
                                : device.state === 'on' ? copy('This device gets notifications.', 'ეს მოწყობილობა შეტყობინებებს იღებს.')
                                : device.state === 'denied' ? copy('This browser blocks notifications for GrassKickZ. Allow them in the address bar (the lock icon), then come back.', 'ეს ბრაუზერი GrassKickZ-ის შეტყობინებებს ბლოკავს. დაუშვით მისამართის ზოლში (ბოქლომის ნიშანი) და დაბრუნდით.')
                                : device.state === 'needs-home-screen' ? copy('On iPhone and iPad, notifications work once GrassKickZ is on your Home Screen: tap Share, then “Add to Home Screen”, and open it from there.', 'iPhone-სა და iPad-ზე შეტყობინებები მუშაობს, როცა GrassKickZ მთავარ ეკრანზეა: დააჭირეთ გაზიარებას, შემდეგ „მთავარ ეკრანზე დამატებას“ და იქიდან გახსენით.')
                                : device.state === 'unsupported' ? copy('This browser cannot show notifications from websites.', 'ეს ბრაუზერი საიტების შეტყობინებებს ვერ აჩვენებს.')
                                : copy('This device does not get notifications yet.', 'ეს მოწყობილობა შეტყობინებებს ჯერ არ იღებს.')}
                        </p>
                    </div>
                    {preferences.pushConfigured && (device.state === 'off' || device.state === 'on') && (
                        <button type="button" className={device.state === 'on' ? btnSecondaryClass : btnPrimaryClass} disabled={device.busy} onClick={() => void (device.state === 'on' ? device.disable() : device.enable())}>
                            {device.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                            {device.state === 'on' ? copy('Turn off on this device', 'ამ მოწყობილობაზე გამორთვა') : copy('Turn on on this device', 'ამ მოწყობილობაზე ჩართვა')}
                        </button>
                    )}
                </div>
                {device.failure && device.failure !== 'denied' && <p role="alert" className="mt-3 text-sm text-[color:var(--fc-state-danger)]">{copy('That did not work. Try again in a moment.', 'ვერ მოხერხდა. სცადეთ ცოტა ხანში.')}</p>}
                {device.state === 'on' && !anyPush && <p className="mt-3 text-sm text-[color:var(--fc-text-secondary)]">{copy('Nothing is pushed yet: pick what below.', 'ჯერ არაფერი იგზავნება: ქვემოთ აირჩიეთ რა.')}</p>}
            </Section>

            <Section title={copy('What you get', 'რას იღებთ')} description={copy('By push, by email, both or neither, for each kind of thing. The bell in the app always shows everything.', 'Push-ით, ელფოსტით, ორივეთი ან არცერთით, თითოეული სახის ამბისთვის. ზარი აპში ყოველთვის ყველაფერს აჩვენებს.')}
                actions={<button type="button" className={btnPrimaryClass} disabled={saving || !dirty} onClick={() => void save()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{copy('Save', 'შენახვა')}</button>}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left">
                            <th scope="col" className={`${labelClass} pb-2`}>{copy('Kind', 'სახეობა')}</th>
                            <th scope="col" className={`${labelClass} w-16 pb-2 text-center`}>{copy('Push', 'Push')}</th>
                            <th scope="col" className={`${labelClass} w-16 pb-2 text-center`}>{copy('Email', 'ელფოსტა')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--fc-border)]">
                        {draft.groups.map(group => (
                            <tr key={group.key}>
                                <td className="py-3 pr-3">
                                    <p className="font-semibold text-[color:var(--fc-text-primary)]">{groupWords[group.key].name}</p>
                                    <p className="text-[13px] leading-5 text-[color:var(--fc-text-secondary)]">{groupWords[group.key].hint}</p>
                                </td>
                                <td className="py-3 text-center"><input type="checkbox" className="h-5 w-5 accent-[var(--fc-accent)]" aria-label={`${groupWords[group.key].name}: ${copy('push', 'push')}`} checked={group.push} onChange={event => setGroup(group.key, { push: event.target.checked })} /></td>
                                <td className="py-3 text-center"><input type="checkbox" className="h-5 w-5 accent-[var(--fc-accent)]" aria-label={`${groupWords[group.key].name}: ${copy('email', 'ელფოსტა')}`} checked={group.email} disabled={preferences.emailUnsubscribed} onChange={event => setGroup(group.key, { email: event.target.checked })} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-3 text-[13px] leading-5 text-[color:var(--fc-text-secondary)]">{copy('Urgent things (a question for you, a cancellation, an invitation) are emailed at once; the rest comes in one daily summary. Several things close together become one ping.', 'სასწრაფო (კითხვა თქვენთვის, გაუქმება, მოწვევა) მაშინვე იგზავნება ელფოსტაზე; დანარჩენი ერთ დღიურ შეჯამებაში მოდის. რამდენიმე ახლო ამბავი ერთ შეტყობინებად იქცევა.')}</p>
                {saved && !dirty && <p role="status" className="mt-3 text-sm font-semibold text-[color:var(--fc-accent)]">{copy('Saved.', 'შენახულია.')}</p>}
            </Section>

            <Section title={copy('When', 'როდის')} description={copy(`Times are in ${browserZone()}.`, `დრო: ${browserZone()}.`)}>
                <div className="grid gap-4 sm:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                        <span className={labelClass}>{copy('Daily summary at', 'დღიური შეჯამება')}</span>
                        <input type="time" className={inputClass} value={draft.digestTime} onChange={event => setDraft({ ...draft, digestTime: event.target.value })} />
                    </label>
                    <div className="sm:col-span-2">
                        <label className="flex min-h-[44px] items-center gap-2">
                            <input type="checkbox" className="h-5 w-5 accent-[var(--fc-accent)]" checked={draft.quiet} onChange={event => setDraft({ ...draft, quiet: event.target.checked })} />
                            <span className={labelClass}>{copy('Quiet hours: no pushes or urgent emails between', 'წყნარი საათები: არც push, არც სასწრაფო ელფოსტა')}</span>
                        </label>
                        <div className="mt-1.5 flex items-center gap-2">
                            <input type="time" aria-label={copy('Quiet from', 'წყნარია -დან')} className={inputClass} disabled={!draft.quiet} value={draft.quietFrom ?? ''} onChange={event => setDraft({ ...draft, quietFrom: event.target.value })} />
                            <span className="text-sm text-[color:var(--fc-text-secondary)]">{copy('and', 'და')}</span>
                            <input type="time" aria-label={copy('Quiet until', 'წყნარია -მდე')} className={inputClass} disabled={!draft.quiet} value={draft.quietUntil ?? ''} onChange={event => setDraft({ ...draft, quietUntil: event.target.value })} />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title={copy('Email', 'ელფოსტა')} description={preferences.email ? copy(`Emails go to ${preferences.email}.`, `წერილები მიდის აქ: ${preferences.email}.`) : copy('No email address on this account.', 'ამ ანგარიშს ელფოსტა არ აქვს.')}>
                {!preferences.emailVerified && <p className="text-sm text-[color:var(--fc-text-secondary)]">{copy('Verify your email (Security tab) before anything is sent to it.', 'სანამ რამე გაიგზავნება, დაადასტურეთ ელფოსტა (უსაფრთხოების ჩანართი).')}</p>}
                {preferences.emailUnsubscribed ? (
                    <div className={`${insetClass} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}>
                        <p className="text-sm text-[color:var(--fc-text-primary)]">{copy('You unsubscribed from notification emails. Security emails (sign-ins, password) still come.', 'შეტყობინებების წერილებზე გამოწერა გაუქმებულია. უსაფრთხოების წერილები (შესვლა, პაროლი) მაინც მოდის.')}</p>
                        <button type="button" className={btnSecondaryClass} disabled={saving} onClick={() => void save({ emailUnsubscribed: false })}>{copy('Turn email back on', 'ელფოსტის ისევ ჩართვა')}</button>
                    </div>
                ) : <p className="text-sm text-[color:var(--fc-text-secondary)]">{copy('Every email has an unsubscribe link at the bottom.', 'ყველა წერილს ბოლოში გამოწერის გაუქმების ბმული აქვს.')}</p>}
            </Section>

            <Section title={copy('Devices', 'მოწყობილობები')} description={copy('Browsers that get pushes for this account.', 'ბრაუზერები, რომლებიც ამ ანგარიშისთვის push-ს იღებენ.')}
                actions={<button type="button" className={btnSecondaryClass} disabled={test.busy} onClick={() => void runTest()}>{test.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{copy('Send a test', 'ტესტის გაგზავნა')}</button>}>
                {test.result && <p role="status" className="mb-3 text-sm font-semibold text-[color:var(--fc-accent)]">{test.result.mode === 'LIVE'
                    ? copy(`On its way to ${test.result.pushDevices} device(s)${test.result.email ? ' and by email' : ''}. It arrives within about 20 seconds.`, `მიდის ${test.result.pushDevices} მოწყობილობაზე${test.result.email ? ' და ელფოსტაზე' : ''}. დაახლოებით 20 წამში მოვა.`)
                    : copy('Recorded. This server is not sending for real (dry-run), so look at the bell and the server log.', 'ჩაიწერა. ეს სერვერი რეალურად არ აგზავნის (სატესტო რეჟიმი), ნახეთ ზარი და სერვერის ლოგი.')}</p>}
                {test.error && <p role="alert" className="mb-3 text-sm text-[color:var(--fc-state-danger)]">{test.error}</p>}
                {preferences.devices.length === 0 ? <p className="text-sm text-[color:var(--fc-text-secondary)]">{copy('No device yet.', 'ჯერ არცერთი მოწყობილობა.')}</p> : (
                    <ul className="divide-y divide-[color:var(--fc-border)]" aria-label={copy('Devices', 'მოწყობილობები')}>
                        {preferences.devices.map(item => (
                            <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                <div className="flex min-w-0 items-center gap-3">
                                    <MonitorSmartphone aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--fc-text-muted)]" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[color:var(--fc-text-primary)]">{item.device || copy('Browser', 'ბრაუზერი')}</p>
                                        <p className="text-[13px] text-[color:var(--fc-text-secondary)]">{item.lastUsedAt ? copy(`Last ping ${fmt(item.lastUsedAt)}`, `ბოლო შეტყობინება ${fmt(item.lastUsedAt)}`) : copy(`Added ${fmt(item.createdAt) ?? ''}`, `დამატებულია ${fmt(item.createdAt) ?? ''}`)}</p>
                                    </div>
                                </div>
                                <button type="button" className={`${btnSecondaryClass} !px-3`} aria-label={copy(`Remove ${item.device || 'device'}`, `წაშალე ${item.device || 'მოწყობილობა'}`)} onClick={() => void removeDevice(item.id)}><Trash2 className="h-4 w-4" /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
};
