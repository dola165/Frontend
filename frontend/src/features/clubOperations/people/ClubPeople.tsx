import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, UserPlus } from 'lucide-react';
import { Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton } from '../../../design/primitives';
import { FilterSelect, ListToolbar, ViewTabs } from '../../../design/DataTable';
import { Dialog } from '../../../design/Dialog';
import { refreshAccess, useCan } from '../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { cancelClubInvitation } from '../../clubs/api';
import type { ClubManagedMember, ClubMembershipInvite } from '../../clubs/domain';
import { OpenRolesPage } from '../../clubWorkspace/commerce/OpenRolesPage';
import { officeToolPath } from '../../clubOffice/officeLinks';
import { answerSuggestion, endJob, fetchPeople, isOwnAccount, newInviteLink, setContactSharing, settleNameCheck, suggestionsIn,
    type InviteLink, type InviteResult, type NameCheck, type Person, type PersonJob, type PeopleView, type Suggestion } from './api';
import { InviteLinkBox } from './InviteLinkBox';
import { InviteStaffDialog, type InviteHow } from './InviteStaffDialog';
import { PersonRow, type PeopleRights } from './PersonRow';
import { InvitationRow, SpecialistRow, StaffNeeds } from './StaffRows';
import { useJobWords } from './jobWords';
import { useStaffLinks } from './useStaffLinks';
import { LeaveClubDialog } from '../leaving/LeaveClubDialog';
import { useLeaveStep } from '../leaving/useLeaveStep';
import '../../clubWorkspace/club-workspace.css';
import './people.css';

const waiting = (job: PersonJob) => job.status === 'INVITED' || job.status === 'EXPIRED' || job.kind.endsWith('INVITE');

/**
 * Club office › Staff (the People screen until step 2, 28 October 2026): everyone with a job here, where, and how to
 * reach them. Everyone on the staff reads it; each person hides their own email or phone from their row. Admins see
 * what needs them first, invite with one Invite (one person, or a staff link), post a job, and change or end anyone's
 * job but the Owner's; invites nobody has answered are Waiting rows. A head coach suggests a helper for their own
 * squad. Who is on duty today shows on their row, and outside specialists are listed with their own job. Which
 * buttons show is the rule-checker's answer; the view, search, filter and the open dialog live in the address.
 */
export function ClubPeople({ clubId, clubName, members = [], invitations = [], tools = {}, onChanged }: {
    clubId: number; clubName: string; members?: ClubManagedMember[]; invitations?: ClubMembershipInvite[];
    /** Club tools this person can open from Staff: Duties and Specialists, which joined Staff. */
    tools?: { duties?: boolean; specialists?: boolean }; onChanged?: () => void;
}) {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate(), leave = useLeaveStep(clubId);
    const [view, setView] = useState<PeopleView | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
    const [ending, setEnding] = useState<{ person: Person; job: PersonJob } | null>(null);
    const [cancelling, setCancelling] = useState<ClubMembershipInvite | null>(null);
    const [links, setLinks] = useState<Record<number, InviteLink>>({});
    const [fresh, setFresh] = useState<{ name: string; link: InviteLink; message: string } | null>(null);
    const { copy, jobLabel, whereLabel } = useJobWords(view ? [...view.jobs, ...view.moreJobs] : []);
    // Older addresses named the dialog's way (invite=person|link|suggest); now one Invite, then how.
    const inviteParam = params.get('invite');
    const inviting = inviteParam !== null && inviteParam !== '';
    const how: InviteHow = params.get('how') === 'link' || inviteParam === 'link' ? 'link' : 'person';
    const query = params.get('q') ?? '', jobFilter = params.get('job') ?? '', showing = params.get('view') === 'waiting' ? 'waiting' : 'all';
    const forPerson = view?.people.find(p => p.userId === Number(params.get('for')));
    const setParam = (patch: Record<string, string | null>, replace = true) => setParams(current => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
        return next;
    }, { replace });
    const openInvite = (open: boolean, extra: Record<string, string | null> = {}) => setParam({ invite: open ? '1' : null, how: null, link: null, for: null, ...extra });

    const can = useCan(`club:${clubId}`);
    const leader = Boolean(view?.viewer.leader), headCoachSquads = view?.viewer.headCoachSquads ?? [];
    const rights: PeopleRights = { pending: can.pending, invite: can.decide('invite_staff', leader).allowed, change: can.decide('change_job', leader).allowed, end: can.decide('end_job', leader).allowed };
    const inviteAdmin = can.decide('make_admin', leader).allowed;
    const suggest = can.decide('suggest_assistant', !leader && headCoachSquads.length > 0);
    const staff = useStaffLinks(clubId, Boolean(view) && rights.invite, inviting && how === 'link', copy('Could not load the staff links.', 'პერსონალის ბმულები ვერ ჩაიტვირთა.'));

    useEffect(() => {
        const controller = new AbortController();
        fetchPeople(clubId, controller.signal).then(data => { if (!controller.signal.aborted) { setView(data); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('Could not load Staff.', 'პერსონალი ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [clubId, revision, copy]);
    const refresh = (message?: string) => { if (message) setNotice(message); setRevision(value => value + 1); refreshAccess(); onChanged?.(); };
    const run = async (work: () => Promise<void>, fallback: string) => {
        setBusy(true); setError('');
        try { await work(); } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    // Older club invitations (players and agents too) that People never listed wait here as well, for admins.
    const shownInvites = useMemo(() => view?.viewer.leader ? invitations.filter(invite => invite.status === 'PENDING'
        && !view.people.some(person => person.jobs.some(job => job.kind.endsWith('INVITE') && job.id === invite.id))) : [], [view, invitations]);
    // Suggestions wait above the list; the list shows the jobs people hold or were invited to.
    const people = useMemo(() => (view?.people ?? []).map(p => ({ ...p, jobs: p.jobs.filter(j => j.status !== 'SUGGESTED') })).filter(p => p.jobs.length), [view]);
    const waitingCount = people.filter(p => p.jobs.some(waiting)).length + shownInvites.length;
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
    const visible = people.filter(p => (showing === 'all' || p.jobs.some(waiting)) && (!jobFilter || p.jobs.some(j => j.job === jobFilter))
        && matches(`${p.name} ${p.email ?? ''} ${p.jobs.map(j => `${jobLabel(j)} ${whereLabel(j)}`).join(' ')}`));
    const invites = jobFilter ? [] : shownInvites.filter(invite => matches(`${invite.fullName ?? ''} ${invite.username}`));
    const specialists = showing === 'waiting' || jobFilter ? [] : (view?.specialists ?? []).filter(s => matches(`${s.name} ${s.specialisation ?? ''}`));
    const jobOptions = [...new Map(people.flatMap(p => p.jobs).map(j => [j.job, j.job === 'CUSTOM' ? copy('Custom', 'საკუთარი') : jobLabel({ ...j, title: '' })])).entries()].map(([value, label]) => ({ value, label }));

    const hideLink = (userId: number) => setLinks(all => Object.fromEntries(Object.entries(all).filter(([id]) => Number(id) !== userId)));
    const ownAccount = (name: string) => copy(`${name} has their own account, so there’s no link to send: the invitation waits for them in the app.`,
        `${name}-ს საკუთარი ანგარიში აქვს, ამიტომ ბმული არ არის საჭირო: მოწვევა აპში ელოდება.`);
    const makeLink = (person: Person) => void run(async () => {
        try {
            const link = await newInviteLink(clubId, person.userId);
            setLinks(all => ({ ...all, [person.userId]: link }));
            setNotice(copy('New link made. The earlier one no longer works.', 'ახალი ბმული შეიქმნა. ძველი აღარ მუშაობს.'));
        } catch (failure) { if (!isOwnAccount(failure)) throw failure; setNotice(ownAccount(person.name)); }
    }, copy('Could not make a new link.', 'ახალი ბმული ვერ შეიქმნა.'));
    const settle = (check: NameCheck, outcome: 'keep' | 'undo') => void run(async () => {
        await settleNameCheck(clubId, check.id, outcome);
        refresh(outcome === 'keep' ? copy('Kept.', 'დატოვებულია.') : copy(`Undone. ${check.acceptedName} no longer has a job here.`, `გაუქმდა. ${check.acceptedName}-ს აქ სამუშაო აღარ აქვს.`));
    }, copy('Could not settle this.', 'ვერ შესრულდა.'));
    const showInvite = (result: InviteResult) => {
        if (result.link) setFresh({ name: result.name, link: result.link, message: copy(`You’re invited to ${clubName}. Choose your password here:`, `მოწვეული ხართ ${clubName}-ში. აირჩიეთ პაროლი აქ:`) });
    };
    const decide = ({ person, job }: Suggestion, decision: 'confirm' | 'decline' | 'withdraw') => void run(async () => {
        const coach = job.suggestedByName ?? copy('The head coach', 'მთავარი მწვრთნელი');
        if (decision === 'withdraw') { await endJob(clubId, person.userId, job); refresh(copy('Withdrawn.', 'გაუქმდა.')); return; }
        const answer = await answerSuggestion(clubId, job, decision === 'confirm').catch(failure => {
            if (!isOwnAccount(failure)) throw failure;
            return null;
        });
        if (!answer) { refresh(ownAccount(person.name)); return; }
        if (answer.link) showInvite({ userId: person.userId, name: person.name, inApp: false, link: answer.link });
        refresh(answer.outcome === 'CONFIRMED' ? copy(`${person.name} is invited as ${jobLabel(job).toLowerCase()}. ${coach} is told.`, `${person.name} მოწვეულია (${jobLabel(job)}). ${coach}-ს ეცნობა.`)
            : copy(`Declined. ${coach} is told.`, `უარყოფილია. ${coach}-ს ეცნობა.`));
    }, copy('Your answer wasn’t saved.', 'პასუხი ვერ შეინახა.'));
    const end = () => {
        const target = ending;
        if (!target) return;
        void run(async () => { await endJob(clubId, target.person.userId, target.job); setEnding(null); refresh(copy(`${target.person.name}: ${jobLabel(target.job)} ended.`, `${target.person.name}: ${jobLabel(target.job)} დასრულდა.`)); },
            copy('Could not end this job.', 'სამუშაო ვერ დასრულდა.'));
    };
    const cancelInvite = () => {
        const target = cancelling;
        if (!target) return;
        void run(async () => { await cancelClubInvitation(clubId, target.id); setCancelling(null); refresh(copy('Invitation cancelled.', 'მოწვევა გაუქმდა.')); },
            copy('The invitation couldn’t be cancelled.', 'მოწვევა ვერ გაუქმდა.'));
    };
    const share = (choice: { hideEmail: boolean; hidePhone: boolean }) => void run(async () => {
        await setContactSharing(clubId, choice);
        setView(current => current && { ...current, viewer: { ...current.viewer, ...choice } });
        setNotice(copy('Saved. Colleagues see what you share.', 'შენახულია. კოლეგები ხედავენ იმას, რასაც აზიარებთ.'));
    }, copy('Your choice wasn’t saved.', 'არჩევანი ვერ შეინახა.'));
    const invited = ending && (ending.job.status === 'INVITED' || ending.job.kind.endsWith('INVITE'));
    const ownSquads = view?.squads.filter(s => headCoachSquads.includes(s.id)) ?? [];
    // A suggestion is always for a squad the person leads: no squad, no button (as in Coach team).
    const canSuggest = suggest.allowed && ownSquads.length > 0;
    const suggestions = view ? suggestionsIn(view.people).filter(s => leader || s.job.suggestedById === view.viewer.userId) : [];
    const dutyHref = tools.duties ? (record: number) => officeToolPath(clubId, 'staff-duties', { record: String(record) }) : undefined;

    if (params.get('view') === 'jobs') return <>
        <div className="office-back"><Button variant="ghost" size="sm" onClick={() => setParam({ view: null }, false)}><ArrowLeft aria-hidden="true" />{copy('Staff', 'პერსონალი')}</Button></div>
        <OpenRolesPage clubId={clubId} pendingKey={null} currentUserId={view?.viewer.userId ?? null} canReviewAllApplications={leader} />
    </>;

    return <PageFrame className="cw-page pp-page">
        <PageHeader title={copy('Staff', 'პერსონალი')}
            actions={<>
                {rights.invite && <Button variant="ghost" disabled={can.pending} onClick={() => setParam({ view: 'jobs' }, false)}><Briefcase aria-hidden="true" />{copy('Post a job', 'ვაკანსიის გამოქვეყნება')}</Button>}
                {(rights.invite || canSuggest) && <Button variant="primary" disabled={can.pending} onClick={() => openInvite(true)}><UserPlus aria-hidden="true" />{copy('Invite', 'მოწვევა')}</Button>}
            </>} />
        <div className="gk-stack">
            {notice && <p role="status" className="gk-notice cw-notices__success">{notice}</p>}
            {error && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span>
                {!view && <Button size="sm" onClick={() => setRevision(v => v + 1)}>{copy('Try again', 'თავიდან')}</Button>}</div>}
            {fresh && <InviteLinkBox name={fresh.name} link={fresh.link} message={fresh.message} onClose={() => setFresh(null)} />}
            {view && (suggestions.length > 0 || view.nameChecks.length > 0) && <Section boxed title={leader ? copy('Needs you', 'თქვენ გელოდებათ') : copy('Your suggestions', 'თქვენი შეთავაზებები')}>
                <StaffNeeds suggestions={suggestions} nameChecks={view.nameChecks} me={view.viewer.userId} admin={leader} busy={busy} onDecide={decide} onSettle={settle} />
            </Section>}
            {view && leader && waitingCount > 0 && <ViewTabs label={copy('Staff views', 'პერსონალის ხედები')} value={showing} onChange={id => setParam({ view: id === 'all' ? null : id })}
                views={[{ id: 'all', label: copy('Everyone', 'ყველა'), count: people.length + shownInvites.length + (view.specialists?.length ?? 0) }, { id: 'waiting', label: copy('Waiting', 'ელოდება'), count: waitingCount }]} />}
            {view && <ListToolbar count={copy(`${visible.length + invites.length + specialists.length} shown`, `ნაჩვენებია ${visible.length + invites.length + specialists.length}`)}
                onClear={query || jobFilter ? () => setParam({ q: null, job: null }) : undefined}>
                <SearchInput className="rec-toolbar__search" aria-label={copy('Find a person', 'პირის ძებნა')} value={query}
                    onChange={event => setParam({ q: event.target.value || null })} placeholder={copy('Name, job or squad', 'სახელი, სამუშაო ან გუნდი')} />
                {jobOptions.length > 1 && <FilterSelect label={copy('Job', 'სამუშაო')} allLabel={copy('All', 'ყველა')} value={jobFilter} options={jobOptions} onChange={value => setParam({ job: value || null })} />}
                {tools.duties && <Link className="pp-toolbar-link" to={officeToolPath(clubId, 'staff-duties')}>{copy('Duties', 'მოვალეობები')}</Link>}
                {tools.specialists && <Link className="pp-toolbar-link" to={officeToolPath(clubId, 'specialists')}>{copy('Specialists', 'სპეციალისტები')}</Link>}
            </ListToolbar>}
            {!view ? !error && <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('Loading Staff', 'პერსონალი იტვირთება')}>{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></Panel>
                : visible.length + invites.length + specialists.length ? <Panel flush><ul className="pp-list" aria-label={copy('Staff', 'პერსონალი')}>
                    {visible.map(person => <PersonRow key={person.userId}
                        club={clubId} clubName={clubName} view={view} person={person} busy={busy} link={links[person.userId]} rights={rights}
                        member={members.find(m => m.userId === person.userId)} dutyHref={dutyHref} onShare={share}
                        onHideLink={() => hideLink(person.userId)} onNewLink={() => makeLink(person)}
                        onAddJob={() => openInvite(true, { for: String(person.userId) })} onEnd={job => setEnding({ person, job })} onLeave={leave.go} onChanged={message => refresh(message)} />)}
                    {invites.map(invite => <InvitationRow key={`i-${invite.id}`} invite={invite} canCancel={rights.invite} busy={busy} onCancel={() => setCancelling(invite)} />)}
                    {specialists.length > 0 && <li className="pp-caption" aria-hidden="true">{copy('Outside specialists', 'გარე სპეციალისტები')}</li>}
                    {specialists.map(specialist => <SpecialistRow key={`x-${specialist.id}`} specialist={specialist} href={tools.specialists ? officeToolPath(clubId, 'specialists', { record: String(specialist.id) }) : null} />)}
                </ul></Panel>
                    : <Panel><EmptyNote title={query || jobFilter ? copy('No one matches', 'ვერაფერი მოიძებნა') : showing === 'waiting' ? copy('Nobody is waiting', 'არავინ ელოდება') : copy('No one here yet', 'ჯერ არავინაა')}
                        action={!query && !jobFilter && rights.invite ? <Button size="sm" onClick={() => openInvite(true)}><UserPlus aria-hidden="true" />{copy('Invite', 'მოწვევა')}</Button> : undefined}>
                        {query || jobFilter ? copy('Try a name, job or squad.', 'სცადეთ სახელი, სამუშაო ან გუნდი.') : copy('Invite your coaches with one link or QR code.', 'მოიწვიეთ მწვრთნელები ერთი ბმულით ან QR კოდით.')}</EmptyNote></Panel>}
        </div>
        {view && inviting && (rights.invite || canSuggest) && <InviteStaffDialog club={clubId} clubName={clubName} view={view} person={forPerson}
            suggest={!rights.invite} allowAdmin={inviteAdmin} how={how} onHow={next => setParam({ how: next === 'link' ? 'link' : null })}
            links={staff.links ?? []} linksLoading={staff.links === null && !staff.error} linksError={staff.error} onRetryLinks={staff.reload}
            openedLink={Number(params.get('link')) || null} onLinks={staff.setLinks} onClose={() => openInvite(false)} onChanged={message => refresh(message)}
            onInvited={result => {
                const added = Boolean(forPerson);
                openInvite(false);
                showInvite(result);
                // Never say whether the address already had an account: with a link, send it; without, they find it on signing in.
                refresh(result.status === 'SUGGESTED' ? copy(`Suggested ${result.name}. An admin confirms or declines it; you’ll be told.`, `${result.name} შეთავაზებულია. ადმინი დაადასტურებს ან უარყოფს; შეგატყობინებთ.`)
                    : result.link ? (added ? copy('Job added. Send the new link.', 'სამუშაო დაემატა. გაგზავნეთ ახალი ბმული.') : copy(`Invited ${result.name}. Send them the link.`, `${result.name} მოწვეულია. გაუგზავნეთ ბმული.`))
                        : copy(`Invited ${result.name}. They’ll find the invitation when they sign in.`, `${result.name} მოწვეულია. მოწვევას შესვლისას ნახავს.`));
            }} />}
        {/* Leaving: someone who left goes to the club's page (Staff is for its staff); a closed club to Home. */}
        <LeaveClubDialog clubId={clubId} clubName={clubName} onDone={(message, outcome) => outcome === 'handed' ? refresh(message) : navigate(outcome === 'closed' ? '/home' : `/clubs/${clubId}`, { replace: true })} />
        <Dialog open={ending !== null} role="alertdialog" size="sm" onClose={() => setEnding(null)}
            title={ending ? `${ending.person.name}: ${jobLabel(ending.job)} · ${whereLabel(ending.job)}` : ''}
            description={invited ? copy('Cancel this invitation? It can no longer be accepted.', 'გაუქმდეს მოწვევა? მისი მიღება აღარ იქნება შესაძლებელი.')
                : copy('End this job? Its tools stop now. Everything they recorded stays with the club.', 'დასრულდეს სამუშაო? ხელსაწყოები ახლავე ითიშება. ყველაფერი, რაც ჩაწერეს, კლუბს რჩება.')}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(null)}>{copy('Keep', 'დატოვება')}</Button>
                <Button variant="danger" disabled={busy} onClick={end}>{invited ? copy('Cancel invite', 'მოწვევის გაუქმება') : copy('End job', 'დასრულება')}</Button></>} />
        <Dialog open={cancelling !== null} role="alertdialog" size="sm" onClose={() => setCancelling(null)}
            title={cancelling ? copy(`Cancel the invitation for ${cancelling.fullName || cancelling.username}?`, `გაუქმდეს მოწვევა: ${cancelling.fullName || cancelling.username}?`) : ''}
            description={copy('They can no longer accept it. You can invite them again later.', 'მისი მიღება აღარ იქნება შესაძლებელი. მოგვიანებით შეგიძლიათ ხელახლა მოიწვიოთ.')}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setCancelling(null)}>{copy('Keep invitation', 'მოწვევის დატოვება')}</Button>
                <Button variant="danger" disabled={busy} onClick={cancelInvite}>{copy('Cancel invitation', 'მოწვევის გაუქმება')}</Button></>} />
    </PageFrame>;
}
