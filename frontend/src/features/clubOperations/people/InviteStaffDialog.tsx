import { useId, useRef, useState } from 'react';
import { Check, Link2Off, QrCode } from 'lucide-react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { LinkShare } from '../../../components/share/LinkShare';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { formatDate } from '../../../utils/formatting';
import { invitePerson, linkJobs, mainJobs, makeStaffLink, staffLinkUrl, stopStaffLink,
    type InviteResult, type JobDraft, type Person, type PeopleView, type StaffLink } from './api';
import { JobPicker } from './JobPicker';
import { useJobWords } from './jobWords';

export type InviteHow = 'person' | 'link';

/** The jobs a staff link can give (never Admin): the main jobs but Admin. */
const LINK_JOBS = ['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'FEES'];

/**
 * One invite (Club office, step 2, 28 October 2026): the job and where first, then how. "Send to one person" works for
 * every job, Admin included: they get a link that works once, or the invitation in the app. "Share a staff link" is
 * for someone you reach by WhatsApp or a QR code (call 7, step 3): it names one person, works once and for 72 hours, for
 * Head coach, Assistant coach, Team manager or Fees, never Admin. For someone already listed (`person`), only the job
 * and where. Admins give jobs; a head coach adds helpers to their sessions instead (step 3, 29 October 2026).
 */
export function InviteStaffDialog({ club, clubName, view, person, allowAdmin, initial, how, onHow, links, linksLoading = false, linksError = '', onRetryLinks, openedLink, onLinks, onClose, onInvited, onChanged }: {
    club: number; clubName: string; view: PeopleView; person?: Person; allowAdmin: boolean;
    /** The job and where a door chose already (a squad's "Invite staff": Assistant coach for that squad). */
    initial?: Pick<JobDraft, 'job' | 'clubWide' | 'squadIds'>;
    how: InviteHow; onHow: (how: InviteHow) => void;
    links: StaffLink[]; linksLoading?: boolean; linksError?: string; onRetryLinks?: () => void; openedLink?: number | null; onLinks: (links: StaffLink[]) => void;
    onClose: () => void; onInvited: (result: InviteResult) => void; onChanged: (notice: string) => void;
}) {
    const id = useId();
    const { copy, jobName } = useJobWords([...view.jobs, ...view.moreJobs]);
    const [draft, setDraft] = useState<JobDraft>({ job: 'HEAD_COACH', title: '', tools: [], clubWide: false, squadIds: [], ...initial });
    const [name, setName] = useState(''), [email, setEmail] = useState(''), [reach, setReach] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const canMake = linkJobs(view).includes(draft.job);
    const linkable = !person && canMake;
    const showLink = how === 'link' && (linkable || links.length > 0) && !person;
    const choices = mainJobs(view).filter(job => allowAdmin || job !== 'ADMIN');
    const problem = !person && name.trim().length < 2 ? copy('Enter their name.', 'შეიყვანეთ სახელი.')
        : !person && !/^\S+@\S+\.\S+$/.test(email.trim()) ? copy('Enter their email.', 'შეიყვანეთ ელფოსტა.')
            : draft.job === 'CUSTOM' && (!draft.title.trim() || !draft.tools.length) ? copy('Name the custom job and tick at least one tool.', 'დაარქვით სამუშაოს სახელი და მონიშნეთ ერთი ხელსაწყო მაინც.')
                : draft.job !== 'ADMIN' && !draft.clubWide && !draft.squadIds.length ? copy('Choose where the job applies.', 'აირჩიეთ, სად ვრცელდება სამუშაო.') : '';
    const send = async () => {
        if (problem) { setError(problem); return; }
        setBusy(true); setError('');
        try {
            onInvited(await invitePerson(club, person ? { userId: person.userId } : { name: name.trim(), email: email.trim() }, draft));
        } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, copy('The invite couldn’t be sent.', 'მოწვევა ვერ გაიგზავნა.'))); setBusy(false); }
    };
    const linkHint = draft.job === 'ADMIN' ? copy('Never Admin. Send it to one person with their email.', 'ადმინი — არასოდეს. გაუგზავნეთ ერთ ადამიანს ელფოსტით.')
        : copy(`Only for ${LINK_JOBS.map(job => jobName(job)).join(', ')}`, `მხოლოდ: ${LINK_JOBS.map(job => jobName(job)).join(', ')}`);
    const title = person ? copy(`Give ${person.name} a job`, `${person.name}: ახალი სამუშაო`) : copy('Invite to a job', 'სამუშაოზე მოწვევა');
    return <Dialog open size="md" onClose={() => { if (!busy) onClose(); }} title={title}
        footer={showLink ? <Button variant="ghost" disabled={busy} onClick={onClose}>{copy('Done', 'მზადაა')}</Button>
            : <><Button variant="ghost" disabled={busy} onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
                <Button variant="primary" disabled={busy} onClick={() => void send()}>{busy ? copy('Sending…', 'იგზავნება…') : copy('Send invite', 'მოწვევის გაგზავნა')}</Button></>}>
        <form className="pp-form" onSubmit={event => { event.preventDefault(); if (!showLink) void send(); }}>
            <JobPicker view={view} draft={draft} onChange={next => { setDraft(next); setError(''); }} choices={choices} extras clubWide disabled={busy} />
            {!person && <fieldset className="pp-how" disabled={busy}>
                <legend className="gk-field__label">{copy('How', 'როგორ')}</legend>
                <div className="cw-options pp-how__options" role="radiogroup" aria-label={copy('How', 'როგორ')}>
                    <button type="button" role="radio" aria-checked={!showLink} className="cw-option" onClick={() => onHow('person')}>
                        <span className="cw-option__mark" aria-hidden="true">{!showLink && <Check />}</span>
                        <span className="cw-option__text"><strong>{copy('Send to one person', 'გაგზავნა ერთ ადამიანზე')}</strong>
                            <span>{copy('Their name and email. A link that works once, or the invite in the app. Every job, Admin too.', 'სახელი და ელფოსტა. ერთჯერადი ბმული ან მოწვევა აპში. ნებისმიერი სამუშაო, ადმინიც.')}</span></span>
                    </button>
                    <button type="button" role="radio" aria-checked={showLink} className="cw-option" disabled={!linkable} onClick={() => onHow('link')}>
                        <span className="cw-option__mark" aria-hidden="true">{showLink && <Check />}</span>
                        <span className="cw-option__text"><strong>{copy('Share a staff link', 'პერსონალის ბმულის გაზიარება')}</strong>
                            <span>{linkable ? copy('A link for one person, by WhatsApp or a QR code. It works once, for 72 hours.', 'ბმული ერთი ადამიანისთვის, WhatsApp-ით ან QR კოდით. მუშაობს ერთხელ, 72 საათი.') : linkHint}</span></span>
                    </button>
                </div>
            </fieldset>}
            {!showLink && !person && <div className="pp-form__who">
                <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" required aria-required="true" autoComplete="off" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></Field>
                <Field label={copy('Email', 'ელფოსტა')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" autoComplete="off" maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></Field>
            </div>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            {showLink && <StaffLinkPanel club={club} clubName={clubName} view={view} draft={draft} canMake={canMake} name={name} reach={reach} onName={setName} onReach={setReach} links={links} opened={openedLink ?? null} loading={linksLoading} loadError={linksError} onRetry={onRetryLinks} onLinks={onLinks} onChanged={onChanged} />}
            <button type="submit" hidden />
        </form>
    </Dialog>;
}

/** What the admin typed: an address has an @, anything else is a phone. */
const namedBy = (reach: string) => reach.includes('@') ? { email: reach.trim() } : { phone: reach.trim() };

/**
 * The staff link for one person: their name and an email or phone, then one link and QR code for the chat. Nobody's
 * link is shared with anyone else, so each person gets their own. Underneath, every link the club has working, each
 * with Show and Switch off, so what is live is in view; a link leaves the list once its person has joined, and they
 * show in Staff waiting for an admin's yes.
 */
function StaffLinkPanel({ club, clubName, view, draft, canMake, name, reach, onName, onReach, links, opened, loading, loadError, onRetry, onLinks, onChanged }: {
    club: number; clubName: string; view: PeopleView; draft: JobDraft; canMake: boolean; name: string; reach: string; onName: (name: string) => void; onReach: (reach: string) => void;
    links: StaffLink[]; opened: number | null; loading: boolean; loadError: string; onRetry?: () => void;
    onLinks: (links: StaffLink[]) => void; onChanged: (notice: string) => void;
}) {
    const id = useId();
    const { copy, jobLabel, whereLabel } = useJobWords([...view.jobs, ...view.moreJobs]);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [shown, setShown] = useState<number | null>(opened);
    const request = useRef<{ key: string; id: string } | null>(null);
    const link = links.find(item => item.id === shown);
    const run = async (work: () => Promise<void>, fallback: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await work(); } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    const make = () => {
        if (!canMake) return;
        if (name.trim().length < 2) { setError(copy('Enter their name.', 'შეიყვანეთ სახელი.')); return; }
        if (!reach.trim()) { setError(copy('Enter their email or phone.', 'შეიყვანეთ ელფოსტა ან ტელეფონი.')); return; }
        if (!draft.clubWide && !draft.squadIds.length) { setError(copy('Choose the whole club or at least one squad.', 'აირჩიეთ მთელი კლუბი ან ერთი გუნდი მაინც.')); return; }
        // A retry after a failure sends the same request id, so the server never makes two links for one tap.
        const key = JSON.stringify([draft, name, reach]);
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        const requestId = request.current.id;
        void run(async () => {
            const made = await makeStaffLink(club, draft, { name: name.trim(), ...namedBy(reach) }, requestId);
            request.current = null;
            onLinks([made, ...links]);
            setShown(made.id);
            onName(''); onReach('');
        }, copy('The link couldn’t be made.', 'ბმული ვერ შეიქმნა.'));
    };
    const stop = (target: StaffLink) => void run(async () => {
        await stopStaffLink(club, target.id);
        if (shown === target.id) setShown(null);
        onLinks(links.filter(l => l.id !== target.id));
        onChanged(copy('Link switched off. Nobody can join through it.', 'ბმული გაითიშა. მისით ვერავინ შემოვა.'));
    }, copy('The link couldn’t be switched off.', 'ბმული ვერ გაითიშა.'));
    const whereOf = (item: StaffLink) => item.clubWide ? copy('Whole club', 'მთელი კლუბი') : whereLabel(item);
    const reachOf = (item: StaffLink) => item.invitedEmail ?? item.invitedPhone ?? '';
    return <div className="pp-staff-link">
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {loadError && <div className="gk-notice gk-notice--danger pp-check" role="alert">
            <span className="cw-notices__text">{loadError}</span>
            {onRetry && <Button size="sm" onClick={onRetry}>{copy('Try again', 'თავიდან')}</Button>}
        </div>}
        {link ? <>
            <LinkShare url={staffLinkUrl(link)} title={`${link.invitedName} · ${jobLabel(link)}`} subtitle={clubName} label={copy('Staff link', 'პერსონალის ბმული')} onError={setError}
                message={copy(`${link.invitedName}, join ${clubName} as ${jobLabel(link)}:`, `${link.invitedName}, შემოუერთდით ${clubName}-ს (${jobLabel(link)}):`)} />
            <div className="pp-staff-link__meta">
                <span className="gk-muted">{copy(`For ${link.invitedName} · works once · until ${formatDate(link.expiresAt, { day: 'numeric', month: 'short' })}`,
                    `${link.invitedName} · ერთჯერადი · ${formatDate(link.expiresAt, { day: 'numeric', month: 'short' })}-მდე`)}</span>
                <span className="gk-row">
                    {canMake && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setShown(null)}><QrCode aria-hidden="true" />{copy('Link for someone else', 'ბმული სხვისთვის')}</Button>}
                    <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={() => stop(link)}><Link2Off aria-hidden="true" />{copy('Switch off', 'გათიშვა')}</Button>
                </span>
            </div>
        </> : canMake ? <div className="pp-staff-link__make">
            <div className="pp-form__who">
                <Field label={copy('Their name', 'მათი სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" required autoComplete="off" maxLength={120} value={name} disabled={busy} onChange={event => onName(event.target.value)} /></Field>
                <Field label={copy('Their email or phone', 'მათი ელფოსტა ან ტელეფონი')} htmlFor={`${id}-reach`} hint={copy('We email them a code to prove it. With a phone, they type this number and you check it’s them.', 'ელფოსტაზე კოდს გავუგზავნით. ტელეფონის შემთხვევაში ამ ნომერს თვითონ შეიყვანენ, თქვენ კი ამოწმებთ, რომ ისინი არიან.')}><input id={`${id}-reach`} className="gk-input" required autoComplete="off" maxLength={254} value={reach} disabled={busy} onChange={event => onReach(event.target.value)} /></Field>
            </div>
            <Button variant="primary" disabled={busy} onClick={make}><QrCode aria-hidden="true" />{busy ? copy('Making…', 'იქმნება…') : copy('Make the link', 'ბმულის შექმნა')}</Button>
            <span className="gk-faint">{copy('Works once, for 72 hours.', 'მუშაობს ერთხელ, 72 საათი.')}</span>
        </div> : null}
        {loading && !links.length && <p className="gk-faint" role="status">{copy('Loading the club’s links…', 'კლუბის ბმულები იტვირთება…')}</p>}
        {links.length > 0 && <section className="pp-links" aria-label={copy('Working links', 'მოქმედი ბმულები')}>
            <h3 className="pp-joined__title">{copy('Working links', 'მოქმედი ბმულები')} <span className="gk-faint">{links.length}</span></h3>
            <ul className="pp-links__list">{links.map(item => <li key={item.id} className="pp-links__row" aria-current={item.id === link?.id || undefined}>
                <span className="pp-links__what"><strong>{item.invitedName ?? jobLabel(item)}</strong><small className="gk-muted">{jobLabel(item)} · {whereOf(item)}</small></span>
                <small className="gk-faint pp-links__left">{reachOf(item)}</small>
                <span className="gk-row">
                    {item.id !== link?.id && <Button size="sm" variant="ghost" disabled={busy} aria-label={copy(`Show the link for ${item.invitedName}`, `ჩვენება: ${item.invitedName}`)} onClick={() => setShown(item.id)}>{copy('Show', 'ჩვენება')}</Button>}
                    <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} aria-label={copy(`Switch off the link for ${item.invitedName}`, `გათიშვა: ${item.invitedName}`)} onClick={() => stop(item)}><Link2Off aria-hidden="true" />{copy('Switch off', 'გათიშვა')}</Button>
                </span>
            </li>)}</ul>
        </section>}
    </div>;
}
