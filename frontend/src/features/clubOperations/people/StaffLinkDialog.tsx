import { useRef, useState } from 'react';
import { Link2Off, QrCode, RefreshCw } from 'lucide-react';
import { Avatar, Button } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { LinkShare } from '../../../components/share/LinkShare';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { formatDate } from '../../../utils/formatting';
import { relativeTime } from '../../../utils/relativeTime';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { JobPicker } from './JobPicker';
import { LINK_JOBS, makeStaffLink, removeJoined, staffLinkUrl, stopStaffLink, type JobDraft, type PeopleView, type StaffLink } from './api';
import { useJobWords } from './jobWords';

const sameWhere = (link: StaffLink, draft: JobDraft) => link.clubWide ? draft.clubWide
    : !draft.clubWide && link.squads.length === draft.squadIds.length && link.squads.every(s => draft.squadIds.includes(s.id));
const draftFor = (link?: StaffLink): JobDraft => link ? { job: link.job, title: '', tools: [], clubWide: link.clubWide, squadIds: link.squads.map(s => s.id) }
    : { job: 'HEAD_COACH', title: '', tools: [], clubWide: true, squadIds: [] };

/**
 * Invite staff in bulk: pick one job (and, if it helps, squads), then one link and QR code for the group chat or the
 * staff room. 7 days or 10 uses; who joined shows underneath as they join, each with Remove. Never Admin: admins
 * are invited one by one. New link replaces the old one for the same job and where.
 */
export function StaffLinkDialog({ club, clubName, view, links, loading = false, loadError = '', onRetry, opened, onLinks, onClose, onChanged }: {
    club: number; clubName: string; view: PeopleView; links: StaffLink[]; loading?: boolean; loadError?: string; onRetry?: () => void; opened?: number | null;
    onLinks: (links: StaffLink[]) => void; onClose: () => void; onChanged: (notice: string) => void;
}) {
    const { copy, jobName, whereLabel } = useJobWords([...view.jobs, ...view.moreJobs]);
    const [draft, setDraft] = useState<JobDraft>(() => draftFor(links.find(l => l.id === opened) ?? links[0]));
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [removing, setRemoving] = useState<number | null>(null);
    const request = useRef<{ key: string; id: string } | null>(null);
    const [stale, setStale] = useState<StaffLink | null>(null);
    const link = links.find(l => l.job === draft.job && sameWhere(l, draft));
    const run = async (work: () => Promise<void>, fallback: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { await work(); } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    const make = () => {
        if (!draft.clubWide && !draft.squadIds.length) { setError(copy('Choose the whole club or at least one squad.', 'აირჩიეთ მთელი კლუბი ან ერთი გუნდი მაინც.')); return; }
        // A retry after a failure sends the same request id, so the server never makes two links for one tap.
        const key = JSON.stringify([draft, link?.id ?? null]);
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        const requestId = request.current.id;
        void run(async () => {
            const made = await makeStaffLink(club, draft, requestId);
            request.current = null;
            // New link replaces the old one for the same job and where. The new one shows at once; the old one is then
            // switched off, and if that fails it is named with its own Switch off, so a retry never makes a third link.
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
    const remove = (target: StaffLink, person: StaffLink['joined'][number]) => void run(async () => {
        await removeJoined(club, person);
        setRemoving(null);
        onLinks(links.map(l => l.id === target.id ? { ...l, joined: l.joined.filter(j => j.appointmentId !== person.appointmentId) } : l));
        onChanged(copy(`${person.name} removed. Their job here has ended.`, `${person.name} მოიხსნა. მისი სამუშაო აქ დასრულდა.`));
    }, copy('They couldn’t be removed.', 'ვერ მოიხსნა.'));
    const title = `${jobName(draft.job)} · ${draft.clubWide ? copy('Whole club', 'მთელი კლუბი') : whereLabel({ clubWide: false, squads: view.squads.filter(s => draft.squadIds.includes(s.id)) })}`;
    const left = link ? Math.max(0, link.maxUses - link.uses) : 0;
    const joined = link?.joined.filter(person => person.status !== 'ENDED') ?? [];

    return <Dialog open size="md" onClose={() => { if (!busy) onClose(); }} title={copy('Invite staff', 'პერსონალის მოწვევა')}
        description={copy('One link for many people. Admins are invited one by one.', 'ერთი ბმული ბევრისთვის. ადმინებს სათითაოდ იწვევთ.')}>
        <div className="pp-staff-link">
            <JobPicker view={view} draft={draft} onChange={next => { setDraft(next); setError(''); }} choices={LINK_JOBS} extras={false} disabled={busy} />
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
                        <Button size="sm" variant="ghost" disabled={busy} onClick={make}><RefreshCw aria-hidden="true" />{copy('New link', 'ახალი ბმული')}</Button>
                        <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={() => stop(link)}><Link2Off aria-hidden="true" />{copy('Switch off', 'გათიშვა')}</Button>
                    </span>
                </div>
                <section className="pp-joined" aria-label={copy('Joined through this link', 'ამ ბმულით შემოვიდნენ')}>
                    <h3 className="pp-joined__title">{copy('Joined', 'შემოვიდნენ')} <span className="gk-faint">{joined.length}</span></h3>
                    {joined.length ? <ul className="pp-joined__list">{joined.map(person => <li key={person.appointmentId} className="pp-joined__row">
                        <Avatar src={resolveMediaUrl(person.avatarUrl) || null} name={person.name} size={32} />
                        <span className="pp-joined__who"><strong>{person.name}</strong><small className="gk-faint">{relativeTime(person.joinedAt)}</small></span>
                        {removing === person.appointmentId ? <span className="gk-row">
                            <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(link, person)}>{copy('Remove', 'მოხსნა')}</Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(null)}>{copy('Keep', 'დატოვება')}</Button>
                        </span> : <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} aria-label={copy(`Remove ${person.name}`, `მოხსნა: ${person.name}`)} onClick={() => setRemoving(person.appointmentId)}>{copy('Remove', 'მოხსნა')}</Button>}
                    </li>)}</ul> : <p className="gk-faint pp-joined__empty">{copy('Nobody yet. Names appear here as people join.', 'ჯერ არავინ. სახელები აქ გამოჩნდება, როგორც კი შემოვლენ.')}</p>}
                </section>
            </> : loading || loadError ? null : <div className="pp-staff-link__make">
                <Button variant="primary" disabled={busy} onClick={make}><QrCode aria-hidden="true" />{busy ? copy('Making…', 'იქმნება…') : copy('Make the link', 'ბმულის შექმნა')}</Button>
                <span className="gk-faint">{copy('Works for 7 days or 10 people.', 'მოქმედებს 7 დღე ან 10 ადამიანზე.')}</span>
            </div>}
        </div>
    </Dialog>;
}
