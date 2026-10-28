import { useId, useRef, useState } from 'react';
import { Check, Link2Off, QrCode, RefreshCw } from 'lucide-react';
import { Avatar, Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { LinkShare } from '../../../components/share/LinkShare';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { formatDate } from '../../../utils/formatting';
import { relativeTime } from '../../../utils/relativeTime';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { HELPER_JOBS, invitePerson, linkJobs, mainJobs, makeStaffLink, removeJoined, staffLinkMatches, staffLinkUrl, stopStaffLink,
    type InviteResult, type JobDraft, type Person, type PeopleView, type StaffLink } from './api';
import { JobPicker } from './JobPicker';
import { useJobWords } from './jobWords';

export type InviteHow = 'person' | 'link';

/** The jobs a staff link can give (never Admin): the main jobs but Admin. */
const LINK_JOBS = ['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'FEES'];
const draftFor = (link: StaffLink): JobDraft => ({ job: link.job, title: link.title, tools: link.tools ?? [], clubWide: link.clubWide, squadIds: link.squads.map(s => s.id) });

/**
 * One invite (Club office, step 2, 28 October 2026): the job and where first, then how. "Send to one person" works for
 * every job, Admin included: they get a link that works once, or the invitation in the app. "Share a staff link" is
 * one link and QR code for Head coach, Assistant coach, Team manager or Fees, never Admin, since a link can be
 * forwarded: 7 days or 10 people, who joined listed underneath. A head coach gets the same dialog for the squads they
 * coach, sent as a suggestion an admin confirms. For someone already listed (`person`), only the job and where.
 */
export function InviteStaffDialog({ club, clubName, view, person, suggest, allowAdmin, initial, how, onHow, links, linksLoading = false, linksError = '', onRetryLinks, openedLink, onLinks, onClose, onInvited, onChanged }: {
    club: number; clubName: string; view: PeopleView; person?: Person; suggest: boolean; allowAdmin: boolean;
    /** The job and where a door chose already (a squad's "Invite staff": Assistant coach for that squad). */
    initial?: Pick<JobDraft, 'job' | 'clubWide' | 'squadIds'>;
    how: InviteHow; onHow: (how: InviteHow) => void;
    links: StaffLink[]; linksLoading?: boolean; linksError?: string; onRetryLinks?: () => void; openedLink?: number | null; onLinks: (links: StaffLink[]) => void;
    onClose: () => void; onInvited: (result: InviteResult) => void; onChanged: (notice: string) => void;
}) {
    const id = useId();
    const { copy, jobName } = useJobWords([...view.jobs, ...view.moreJobs]);
    const own = view.viewer.headCoachSquads;
    // A head coach suggests for the squads they coach; the picker only offers those.
    const pickerView = suggest ? { ...view, squads: view.squads.filter(squad => own.includes(squad.id)) } : view;
    // A link named in the address opens with its job and where, and so does Share a staff link before anything is
    // chosen: the newest link, ready to share.
    const preset = (list: StaffLink[], way: InviteHow) => person || suggest ? undefined : list.find(link => link.id === openedLink) ?? (way === 'link' ? list[0] : undefined);
    const [draft, setDraft] = useState<JobDraft>(() => {
        const opened = preset(links, how);
        return opened ? draftFor(opened) : { job: suggest ? HELPER_JOBS[0] : 'HEAD_COACH', title: '', tools: [], clubWide: false, squadIds: own.length === 1 ? own : [], ...initial };
    });
    const [name, setName] = useState(''), [email, setEmail] = useState(''), [touched, setTouched] = useState(false);
    // The links often arrive after the dialog opens: the first ones set the job, unless one was chosen meanwhile.
    const [arrived, setArrived] = useState(links.length > 0);
    if (!arrived && links.length) {
        setArrived(true);
        const opened = touched ? undefined : preset(links, how);
        if (opened) setDraft(draftFor(opened));
    }
    const chooseHow = (next: InviteHow) => { const opened = touched ? undefined : preset(links, next); if (opened) setDraft(draftFor(opened)); onHow(next); };
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    // A link for a job no longer offered for links (an older one) still shows, so it can be shared or switched off.
    const canMake = linkJobs(view).includes(draft.job);
    const linkable = !suggest && !person && (canMake || links.some(link => staffLinkMatches(link, draft, view)));
    const showLink = how === 'link' && linkable;
    const choices = suggest ? [...HELPER_JOBS] : mainJobs(view).filter(job => allowAdmin || job !== 'ADMIN');
    const problem = !person && name.trim().length < 2 ? copy('Enter their name.', 'შეიყვანეთ სახელი.')
        : !person && !/^\S+@\S+\.\S+$/.test(email.trim()) ? copy('Enter their email.', 'შეიყვანეთ ელფოსტა.')
            : draft.job === 'CUSTOM' && (!draft.title.trim() || !draft.tools.length) ? copy('Name the custom job and tick at least one tool.', 'დაარქვით სამუშაოს სახელი და მონიშნეთ ერთი ხელსაწყო მაინც.')
                : draft.job !== 'ADMIN' && !draft.clubWide && !draft.squadIds.length ? copy('Choose where the job applies.', 'აირჩიეთ, სად ვრცელდება სამუშაო.') : '';
    const send = async () => {
        if (problem) { setError(problem); return; }
        setBusy(true); setError('');
        try {
            // From a head coach an invite is a suggestion: it waits for an admin (SUGGESTED, no link yet).
            onInvited(await invitePerson(club, person ? { userId: person.userId } : { name: name.trim(), email: email.trim() }, draft));
        } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, suggest ? copy('The suggestion couldn’t be sent.', 'შეთავაზება ვერ გაიგზავნა.') : copy('The invite couldn’t be sent.', 'მოწვევა ვერ გაიგზავნა.'))); setBusy(false); }
    };
    const linkHint = draft.job === 'ADMIN' ? copy('Never Admin: a link can be forwarded. Send it to one person.', 'ადმინი — არასოდეს: ბმული შეიძლება გადაიგზავნოს. გაუგზავნეთ ერთ ადამიანს.')
        : copy(`Only for ${LINK_JOBS.map(job => jobName(job)).join(', ')}`, `მხოლოდ: ${LINK_JOBS.map(job => jobName(job)).join(', ')}`);
    const title = person ? copy(`Give ${person.name} a job`, `${person.name}: ახალი სამუშაო`) : suggest ? copy('Suggest a helper', 'დამხმარის შეთავაზება') : copy('Invite to a job', 'სამუშაოზე მოწვევა');
    return <Dialog open size="md" onClose={() => { if (!busy) onClose(); }} title={title}
        description={suggest ? copy('For a squad you coach. An admin confirms it; you’ll be told.', 'გუნდისთვის, რომელსაც წვრთნით. ადმინი დაადასტურებს; შეგატყობინებთ.') : undefined}
        footer={showLink ? <Button variant="ghost" disabled={busy} onClick={onClose}>{copy('Done', 'მზადაა')}</Button>
            : <><Button variant="ghost" disabled={busy} onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
                <Button variant="primary" disabled={busy} onClick={() => void send()}>{busy ? copy('Sending…', 'იგზავნება…') : suggest ? copy('Send suggestion', 'შეთავაზების გაგზავნა') : copy('Send invite', 'მოწვევის გაგზავნა')}</Button></>}>
        <form className="pp-form" onSubmit={event => { event.preventDefault(); if (!showLink) void send(); }}>
            <JobPicker view={pickerView} draft={draft} onChange={next => { setDraft(next); setTouched(true); setError(''); }} choices={choices} extras={!suggest} clubWide={!suggest} disabled={busy} />
            {!suggest && !person && <fieldset className="pp-how" disabled={busy}>
                <legend className="gk-field__label">{copy('How', 'როგორ')}</legend>
                <div className="cw-options pp-how__options" role="radiogroup" aria-label={copy('How', 'როგორ')}>
                    <button type="button" role="radio" aria-checked={!showLink} className="cw-option" onClick={() => chooseHow('person')}>
                        <span className="cw-option__mark" aria-hidden="true">{!showLink && <Check />}</span>
                        <span className="cw-option__text"><strong>{copy('Send to one person', 'გაგზავნა ერთ ადამიანზე')}</strong>
                            <span>{copy('Their name and email. A link that works once, or the invite in the app. Every job, Admin too.', 'სახელი და ელფოსტა. ერთჯერადი ბმული ან მოწვევა აპში. ნებისმიერი სამუშაო, ადმინიც.')}</span></span>
                    </button>
                    <button type="button" role="radio" aria-checked={showLink} className="cw-option" disabled={!linkable} onClick={() => chooseHow('link')}>
                        <span className="cw-option__mark" aria-hidden="true">{showLink && <Check />}</span>
                        <span className="cw-option__text"><strong>{copy('Share a staff link', 'პერსონალის ბმულის გაზიარება')}</strong>
                            <span>{linkable ? copy('Anyone with it joins as this job straight away, for 7 days or 10 people.', 'ვისაც ექნება, მაშინვე შემოვა ამ სამუშაოზე, 7 დღე ან 10 ადამიანი.') : linkHint}</span></span>
                    </button>
                </div>
            </fieldset>}
            {!showLink && !person && <div className="pp-form__who">
                <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" required aria-required="true" autoComplete="off" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></Field>
                <Field label={copy('Email', 'ელფოსტა')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" autoComplete="off" maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></Field>
            </div>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            {showLink && <StaffLinkPanel club={club} clubName={clubName} view={view} draft={draft} canMake={canMake} links={links} loading={linksLoading} loadError={linksError} onRetry={onRetryLinks} onLinks={onLinks} onChanged={onChanged} />}
            <button type="submit" hidden />
        </form>
    </Dialog>;
}

/**
 * The staff link for the chosen job and where: one link and QR code for the group chat or the staff room, 7 days or
 * 10 uses, who joined underneath as they join, each with Remove. New link replaces the old one for the same job,
 * title and scope (and tools for Custom).
 */
function StaffLinkPanel({ club, clubName, view, draft, canMake, links, loading, loadError, onRetry, onLinks, onChanged }: {
    club: number; clubName: string; view: PeopleView; draft: JobDraft; canMake: boolean; links: StaffLink[]; loading: boolean; loadError: string; onRetry?: () => void;
    onLinks: (links: StaffLink[]) => void; onChanged: (notice: string) => void;
}) {
    const { copy, jobLabel, whereLabel } = useJobWords([...view.jobs, ...view.moreJobs]);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [removing, setRemoving] = useState<number | null>(null);
    const request = useRef<{ key: string; id: string } | null>(null);
    const [stale, setStale] = useState<StaffLink | null>(null);
    const link = links.find(l => staffLinkMatches(l, draft, view));
    const run = async (work: () => Promise<void>, fallback: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await work(); } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    const make = () => {
        if (!canMake) return;
        if (!draft.clubWide && !draft.squadIds.length) { setError(copy('Choose the whole club or at least one squad.', 'აირჩიეთ მთელი კლუბი ან ერთი გუნდი მაინც.')); return; }
        // A retry after a failure sends the same request id, so the server never makes two links for one tap.
        const key = JSON.stringify([draft, link?.id ?? null]);
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        const requestId = request.current.id;
        void run(async () => {
            const made = await makeStaffLink(club, draft, requestId);
            request.current = null;
            // The new link shows at once; the old one is then switched off, and if that fails it is named with its own
            // Switch off, so a retry never makes a third link.
            const old = link;
            onLinks([made, ...links]);
            if (!old) return;
            try {
                await stopStaffLink(club, old.id);
                onLinks([made, ...links.filter(l => l.id !== old.id)]);
                onChanged(copy('New link made. The earlier one no longer works.', 'ახალი ბმული შეიქმნა. ძველი აღარ მუშაობს.'));
            } catch { setStale(old); }
        }, copy('The link couldn’t be made.', 'ბმული ვერ შეიქმნა.'));
    };
    const stop = (target: StaffLink) => void run(async () => {
        await stopStaffLink(club, target.id);
        if (stale?.id === target.id) setStale(null);
        onLinks(links.filter(l => l.id !== target.id));
        onChanged(copy('Link switched off. Nobody else can join through it.', 'ბმული გაითიშა. მისით აღარავინ შემოვა.'));
    }, copy('The link couldn’t be switched off.', 'ბმული ვერ გაითიშა.'));
    const remove = (target: StaffLink, joined: StaffLink['joined'][number]) => void run(async () => {
        await removeJoined(club, joined);
        setRemoving(null);
        onLinks(links.map(l => l.id === target.id ? { ...l, joined: l.joined.filter(j => j.appointmentId !== joined.appointmentId) } : l));
        onChanged(copy(`${joined.name} removed. Their job here has ended.`, `${joined.name} მოიხსნა. მისი სამუშაო აქ დასრულდა.`));
    }, copy('They couldn’t be removed.', 'ვერ მოიხსნა.'));
    const title = `${jobLabel(link ?? draft)} · ${draft.clubWide ? copy('Whole club', 'მთელი კლუბი') : whereLabel({ clubWide: false, squads: view.squads.filter(s => draft.squadIds.includes(s.id)) })}`;
    const left = link ? Math.max(0, link.maxUses - link.uses) : 0;
    const joined = link?.joined.filter(item => item.status !== 'ENDED') ?? [];
    return <div className="pp-staff-link">
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {stale && <div className="gk-notice gk-notice--warning pp-check" role="alert">
            <span className="cw-notices__text">{copy('The old link is still on.', 'ძველი ბმული ჯერ კიდევ მუშაობს.')}</span>
            <Button size="sm" disabled={busy} onClick={() => stop(stale)}><Link2Off aria-hidden="true" />{copy('Switch off', 'გათიშვა')}</Button>
        </div>}
        {loadError && <div className="gk-notice gk-notice--danger pp-check" role="alert">
            <span className="cw-notices__text">{loadError}</span>
            {onRetry && <Button size="sm" onClick={onRetry}>{copy('Try again', 'თავიდან')}</Button>}
        </div>}
        {loading && !link && <p className="gk-faint" role="status">{copy('Loading the club’s links…', 'კლუბის ბმულები იტვირთება…')}</p>}
        {link ? <>
            <LinkShare url={staffLinkUrl(link)} title={title} subtitle={clubName} label={copy('Staff link', 'პერსონალის ბმული')} onError={setError}
                message={copy(`Join ${clubName} as ${title}:`, `შემოუერთდით ${clubName}-ს (${title}):`)} />
            <div className="pp-staff-link__meta">
                <span className="gk-muted">{copy(`Until ${formatDate(link.expiresAt, { day: 'numeric', month: 'short' })} · ${left} of ${link.maxUses} uses left`,
                    `${formatDate(link.expiresAt, { day: 'numeric', month: 'short' })}-მდე · დარჩა ${left} / ${link.maxUses}`)}</span>
                <span className="gk-row">
                    {canMake && <Button size="sm" variant="ghost" disabled={busy} onClick={make}><RefreshCw aria-hidden="true" />{copy('New link', 'ახალი ბმული')}</Button>}
                    <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={() => stop(link)}><Link2Off aria-hidden="true" />{copy('Switch off', 'გათიშვა')}</Button>
                </span>
            </div>
            <section className="pp-joined" aria-label={copy('Joined through this link', 'ამ ბმულით შემოვიდნენ')}>
                <h3 className="pp-joined__title">{copy('Joined', 'შემოვიდნენ')} <span className="gk-faint">{joined.length}</span></h3>
                {joined.length ? <ul className="pp-joined__list">{joined.map(item => <li key={item.appointmentId} className="pp-joined__row">
                    <Avatar src={resolveMediaUrl(item.avatarUrl) || null} name={item.name} size={32} />
                    <span className="pp-joined__who"><strong>{item.name}</strong><small className="gk-faint">{relativeTime(item.joinedAt)}</small></span>
                    {removing === item.appointmentId ? <span className="gk-row">
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(link, item)}>{copy('Remove', 'მოხსნა')}</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(null)}>{copy('Keep', 'დატოვება')}</Button>
                    </span> : <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} aria-label={copy(`Remove ${item.name}`, `მოხსნა: ${item.name}`)} onClick={() => setRemoving(item.appointmentId)}>{copy('Remove', 'მოხსნა')}</Button>}
                </li>)}</ul> : <p className="gk-faint pp-joined__empty">{copy('Nobody yet. Names appear here as people join.', 'ჯერ არავინ. სახელები აქ გამოჩნდება, როგორც კი შემოვლენ.')}</p>}
            </section>
        </> : loading || loadError ? null : <div className="pp-staff-link__make">
            <Button variant="primary" disabled={busy} onClick={make}><QrCode aria-hidden="true" />{busy ? copy('Making…', 'იქმნება…') : copy('Make the link', 'ბმულის შექმნა')}</Button>
            <span className="gk-faint">{copy('Works for 7 days or 10 people.', 'მოქმედებს 7 დღე ან 10 ადამიანზე.')}</span>
        </div>}
    </div>;
}
