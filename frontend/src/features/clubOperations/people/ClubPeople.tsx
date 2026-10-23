import { useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, UserPlus } from 'lucide-react';
import { Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { ResponsibilityRequests } from '../../clubWorkspace/coachHub/ResponsibilityRequests';
import type { ClubManagedMember } from '../../clubs/domain';
import type { RolesWorkspace } from '../useWorkspaceRoles';
import { endJob, fetchPeople, newInviteLink, settleNameCheck, type InviteLink, type Person, type PersonJob, type PeopleView } from './api';
import { InviteDialog } from './InviteDialog';
import { InviteLinkBox } from './InviteLinkBox';
import { PersonRow } from './PersonRow';
import { useJobWords } from './jobWords';
import '../../clubWorkspace/club-workspace.css';
import './people.css';

/**
 * The club's People: one list of person → jobs → where. Admins invite with name, email, job and where, and change
 * jobs in place; a head coach invites helpers to their own squads and asks an admin for anything else.
 */
export function ClubPeople({ clubId, clubName, roles, members = [], onChanged }: {
    clubId: number; clubName: string; roles?: RolesWorkspace | null; members?: ClubManagedMember[]; onChanged?: () => void;
}) {
    const [view, setView] = useState<PeopleView | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const [query, setQuery] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
    const [inviting, setInviting] = useState<{ person?: Person } | null>(null), [asking, setAsking] = useState(false);
    const [ending, setEnding] = useState<{ person: Person; job: PersonJob } | null>(null);
    const [links, setLinks] = useState<Record<number, InviteLink>>({});
    const [fresh, setFresh] = useState<{ name: string; link: InviteLink; message: string } | null>(null);
    const { copy, jobLabel, whereLabel } = useJobWords(view ? [...view.jobs, ...view.moreJobs] : []);
    useEffect(() => {
        const controller = new AbortController();
        fetchPeople(clubId, controller.signal).then(data => { if (!controller.signal.aborted) { setView(data); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, 'Could not load People.')); });
        return () => controller.abort();
    }, [clubId, revision]);
    const refresh = (message?: string) => { if (message) setNotice(message); setRevision(value => value + 1); onChanged?.(); };
    const run = async (work: () => Promise<void>, fallback: string) => {
        setBusy(true); setError('');
        try { await work(); } catch (failure) { setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (view?.people ?? []).filter(p => !needle || `${p.name} ${p.email ?? ''} ${p.jobs.map(j => `${jobLabel(j)} ${whereLabel(j)}`).join(' ')}`.toLowerCase().includes(needle));
    }, [view, query, jobLabel, whereLabel]);
    const canInvite = Boolean(view && (view.viewer.leader || view.viewer.headCoachSquads.length));
    const headCoach = Boolean(view && !view.viewer.leader && view.viewer.headCoachSquads.length);
    const hideLink = (userId: number) => setLinks(all => Object.fromEntries(Object.entries(all).filter(([id]) => Number(id) !== userId)));
    const makeLink = (person: Person) => void run(async () => {
        const link = await newInviteLink(clubId, person.userId);
        setLinks(all => ({ ...all, [person.userId]: link }));
        setNotice(copy('New link made. The earlier one no longer works.', 'ახალი ბმული შეიქმნა. ძველი აღარ მუშაობს.'));
    }, 'Could not make a new link.');
    const settle = (check: number, outcome: 'keep' | 'undo', done: string) => void run(async () => { await settleNameCheck(clubId, check, outcome); refresh(done); }, 'Could not settle this.');
    const end = () => {
        const target = ending;
        if (!target) return;
        void run(async () => { await endJob(clubId, target.person.userId, target.job, 'Ended from People.'); setEnding(null); refresh(copy('Done.', 'შესრულდა.')); }, 'Could not end this job.');
    };
    const invited = ending && (ending.job.status === 'INVITED' || ending.job.kind.endsWith('INVITE'));

    return <PageFrame className="cw-page pp-page">
        <PageHeader title={copy('People', 'ხალხი')} subtitle={copy('Everyone with a job here, and where.', 'ყველა, ვისაც აქ სამუშაო აქვს, და სად.')}
            actions={<>{headCoach && roles && <Button onClick={() => setAsking(true)}><MessageSquarePlus aria-hidden="true" />{copy('Ask the admin', 'ადმინთან მიმართვა')}</Button>}
                {canInvite && <Button variant="primary" onClick={() => setInviting({})}><UserPlus aria-hidden="true" />{copy('Invite', 'მოწვევა')}</Button>}</>} />
        <div className="gk-stack">
            {notice && <p role="status" className="gk-notice cw-notices__success">{notice}</p>}
            {error && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span>
                {!view && <Button size="sm" onClick={() => setRevision(v => v + 1)}>{copy('Try again', 'თავიდან')}</Button>}</div>}
            {fresh && <InviteLinkBox name={fresh.name} link={fresh.link} message={fresh.message} onClose={() => setFresh(null)} />}
            {view?.nameChecks.map(check => <div key={check.id} className="gk-notice gk-notice--warning pp-check" role="status">
                <span className="cw-notices__text">{copy(`Accepted by ${check.acceptedName}, not ${check.invitedName}.`, `მიიღო ${check.acceptedName}-მ და არა ${check.invitedName}-მ.`)}</span>
                <span className="gk-row">
                    <Button size="sm" disabled={busy} onClick={() => settle(check.id, 'keep', copy('Kept.', 'დატოვებულია.'))}>{copy('Keep', 'დატოვება')}</Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => settle(check.id, 'undo', copy(`Undone. ${check.acceptedName} no longer has a job here.`, `გაუქმდა. ${check.acceptedName}-ს აქ სამუშაო აღარ აქვს.`))}>{copy('Undo', 'გაუქმება')}</Button>
                </span>
            </div>)}
            {view && view.people.length > 6 && <div className="rec-toolbar"><SearchInput className="rec-toolbar__search" aria-label={copy('Find a person', 'პირის ძებნა')} value={query}
                onChange={event => setQuery(event.target.value)} placeholder={copy('Name, job or squad', 'სახელი, სამუშაო ან გუნდი')} /></div>}
            {!view ? !error && <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('Loading people', 'იტვირთება')}>{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></Panel>
                : visible.length ? <Panel flush><ul className="pp-list" aria-label={copy('People', 'ხალხი')}>{visible.map(person => <PersonRow key={person.userId}
                    club={clubId} clubName={clubName} view={view} person={person} busy={busy} link={links[person.userId]}
                    member={members.find(m => m.userId === person.userId)}
                    onHideLink={() => hideLink(person.userId)} onNewLink={() => makeLink(person)}
                    onAddJob={() => setInviting({ person })} onEnd={job => setEnding({ person, job })} onChanged={message => refresh(message)} />)}</ul></Panel>
                    : <Panel><EmptyNote title={query ? copy('No one matches', 'ვერაფერი მოიძებნა') : copy('No one here yet', 'ჯერ არავინაა')}
                        action={!query && canInvite ? <Button size="sm" onClick={() => setInviting({})}><UserPlus aria-hidden="true" />{copy('Invite', 'მოწვევა')}</Button> : undefined}>
                        {query ? copy('Try a name, job or squad.', 'სცადეთ სახელი, სამუშაო ან გუნდი.') : copy('Invite your coaches with their name and email.', 'მოიწვიეთ მწვრთნელები სახელით და ელფოსტით.')}</EmptyNote></Panel>}
        </div>
        {view && <InviteDialog open={inviting !== null} club={clubId} view={view} person={inviting?.person} onClose={() => setInviting(null)}
            onInvited={result => {
                const added = Boolean(inviting?.person);
                setInviting(null);
                if (result.link) setFresh({ name: result.name, link: result.link, message: copy(`You’re invited to ${clubName}. Choose your password here:`, `მოწვეული ხართ ${clubName}-ში. აირჩიეთ პაროლი აქ:`) });
                const told = view.viewer.leader ? '' : ` ${copy('The admins have been told.', 'ადმინებს ეცნობათ.')}`;
                refresh((result.inApp ? copy(`${result.name} already has an account, so the invitation is waiting in their notifications.`, `${result.name}-ს უკვე აქვს ანგარიში, მოწვევა შეტყობინებებში ელოდება.`)
                    : added ? copy('Job added. Send the new link.', 'სამუშაო დაემატა. გაგზავნეთ ახალი ბმული.') : copy(`Invited ${result.name}. Send them the link.`, `${result.name} მოწვეულია. გაუგზავნეთ ბმული.`)) + told);
            }} />}
        <Dialog open={ending !== null} role="alertdialog" size="sm" onClose={() => setEnding(null)}
            title={ending ? `${ending.person.name}: ${jobLabel(ending.job)} · ${whereLabel(ending.job)}` : ''}
            description={invited ? copy('Cancel this invitation? It can no longer be accepted.', 'გაუქმდეს მოწვევა? მისი მიღება აღარ იქნება შესაძლებელი.')
                : copy('End this job? Its tools stop now. Everything they recorded stays with the club.', 'დასრულდეს სამუშაო? ხელსაწყოები ახლავე ითიშება. ყველაფერი, რაც ჩაწერეს, კლუბს რჩება.')}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(null)}>{copy('Keep', 'დატოვება')}</Button>
                <Button variant="danger" disabled={busy} onClick={end}>{invited ? copy('Cancel invite', 'მოწვევის გაუქმება') : copy('End job', 'დასრულება')}</Button></>} />
        {roles && asking && <ResponsibilityRequests open clubId={clubId} roles={roles} onClose={() => setAsking(false)} onChanged={() => onChanged?.()} />}
    </PageFrame>;
}
