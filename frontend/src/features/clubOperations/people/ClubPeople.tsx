import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, UserPlus } from 'lucide-react';
import { Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { AskAdmin } from '../../../components/access/AskAdmin';
import { refreshAccess, useCan } from '../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import type { ClubManagedMember } from '../../clubs/domain';
import { answerSuggestion, endJob, fetchPeople, isOwnAccount, newInviteLink, settleNameCheck, suggestionsIn, type InviteLink, type Suggestion, type InviteResult, type Person, type PersonJob, type PeopleView } from './api';
import { InviteDialog } from './InviteDialog';
import { InviteLinkBox } from './InviteLinkBox';
import { PersonRow, type PeopleRights } from './PersonRow';
import { StaffLinkDialog } from './StaffLinkDialog';
import { StaffLinkList } from './StaffLinkList';
import { SuggestAssistantDialog } from './SuggestAssistantDialog';
import { SuggestionList } from './SuggestionList';
import { useJobWords } from './jobWords';
import { useStaffLinks } from './useStaffLinks';
import '../../clubWorkspace/club-workspace.css';
import './people.css';

type Inviting = 'link' | 'person' | 'suggest';

/**
 * The club's People: one list of person → jobs → where. Admins invite staff in bulk with a staff link and QR code,
 * invite one person (the only way to make an Admin), confirm head coaches' suggested assistants and change or end
 * anyone's job but the Owner's. A head coach suggests an assistant for their own squad. Which buttons show is the
 * rule-checker's answer; the dialog open, the link shown and the search live in the address.
 */
export function ClubPeople({ clubId, clubName, members = [], onChanged }: {
    clubId: number; clubName: string; members?: ClubManagedMember[]; onChanged?: () => void;
}) {
    const [params, setParams] = useSearchParams();
    const [view, setView] = useState<PeopleView | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
    const [ending, setEnding] = useState<{ person: Person; job: PersonJob } | null>(null);
    const [links, setLinks] = useState<Record<number, InviteLink>>({});
    const [fresh, setFresh] = useState<{ name: string; link: InviteLink; message: string } | null>(null);
    const { copy, jobLabel, whereLabel } = useJobWords(view ? [...view.jobs, ...view.moreJobs] : []);
    const inviting = (['link', 'person', 'suggest'] as const).find(value => value === params.get('invite')) ?? null;
    const query = params.get('q') ?? '';
    const forPerson = view?.people.find(p => p.userId === Number(params.get('for')));
    const setParam = (patch: Record<string, string | null>) => setParams(current => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
        return next;
    }, { replace: true });
    const open = (what: Inviting | null, extra: Record<string, string | null> = {}) => setParam({ invite: what, link: null, for: null, ...extra });

    const can = useCan(`club:${clubId}`);
    const leader = Boolean(view?.viewer.leader), headCoachSquads = view?.viewer.headCoachSquads ?? [];
    const rights: PeopleRights = { pending: can.pending, invite: can.decide('invite_staff', leader).allowed, change: can.decide('change_job', leader).allowed, end: can.decide('end_job', leader).allowed };
    const inviteAdmin = can.decide('make_admin', leader).allowed;
    const suggest = can.decide('suggest_assistant', !leader && headCoachSquads.length > 0);
    const refused = [can.decide('invite_staff', leader), suggest].find(decision => !decision.allowed && decision.askAdmin);
    const staff = useStaffLinks(clubId, Boolean(view) && rights.invite, inviting === 'link', copy('Could not load the staff links.', 'პერსონალის ბმულები ვერ ჩაიტვირთა.'));

    useEffect(() => {
        const controller = new AbortController();
        fetchPeople(clubId, controller.signal).then(data => { if (!controller.signal.aborted) { setView(data); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('Could not load People.', 'ხალხი ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [clubId, revision, copy]);
    const refresh = (message?: string) => { if (message) setNotice(message); setRevision(value => value + 1); refreshAccess(); onChanged?.(); };
    const run = async (work: () => Promise<void>, fallback: string) => {
        setBusy(true); setError('');
        try { await work(); } catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, fallback)); } finally { setBusy(false); }
    };
    // Suggestions wait above the list; the list shows the jobs people hold or were invited to.
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (view?.people ?? []).map(p => ({ ...p, jobs: p.jobs.filter(j => j.status !== 'SUGGESTED') })).filter(p => p.jobs.length)
            .filter(p => !needle || `${p.name} ${p.email ?? ''} ${p.jobs.map(j => `${jobLabel(j)} ${whereLabel(j)}`).join(' ')}`.toLowerCase().includes(needle));
    }, [view, query, jobLabel, whereLabel]);
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
    const settle = (check: number, outcome: 'keep' | 'undo', done: string) => void run(async () => { await settleNameCheck(clubId, check, outcome); refresh(done); }, copy('Could not settle this.', 'ვერ შესრულდა.'));
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
    const invited = ending && (ending.job.status === 'INVITED' || ending.job.kind.endsWith('INVITE'));
    const ownSquads = view?.squads.filter(s => headCoachSquads.includes(s.id)) ?? [];
    // A suggestion is always for a squad the person leads: no squad, no button (as in Coach team).
    const canSuggest = suggest.allowed && ownSquads.length > 0;
    const suggestions = view ? suggestionsIn(view.people).filter(s => leader || s.job.suggestedById === view.viewer.userId) : [];
    const activeLinks = staff.links ?? [];

    return <PageFrame className="cw-page pp-page">
        <PageHeader title={copy('People', 'ხალხი')} subtitle={copy('Everyone with a job here, and where.', 'ყველა, ვისაც აქ სამუშაო აქვს, და სად.')}
            actions={<>
                {rights.invite && <Button disabled={can.pending} onClick={() => open('person')}><UserPlus aria-hidden="true" />{copy('Invite one person', 'ერთი ადამიანის მოწვევა')}</Button>}
                {rights.invite && <Button variant="primary" disabled={can.pending} onClick={() => open('link')}><QrCode aria-hidden="true" />{copy('Invite staff', 'პერსონალის მოწვევა')}</Button>}
                {canSuggest && <Button variant="primary" disabled={can.pending} onClick={() => open('suggest')}><UserPlus aria-hidden="true" />{copy('Suggest an assistant', 'ასისტენტის შეთავაზება')}</Button>}
                {!rights.invite && !canSuggest && refused && <AskAdmin reason={refused.reason} admin={can.admin} />}
            </>} />
        <div className="gk-stack">
            {notice && <p role="status" className="gk-notice cw-notices__success">{notice}</p>}
            {(error || staff.error) && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error || staff.error}</span>
                {(!view || (!error && staff.error)) && <Button size="sm" onClick={() => { if (!view) setRevision(v => v + 1); else staff.reload(); }}>{copy('Try again', 'თავიდან')}</Button>}</div>}
            {fresh && <InviteLinkBox name={fresh.name} link={fresh.link} message={fresh.message} onClose={() => setFresh(null)} />}
            {view?.nameChecks.map(check => <div key={check.id} className="gk-notice gk-notice--warning pp-check" role="status">
                <span className="cw-notices__text">{copy(`Accepted by ${check.acceptedName}, not ${check.invitedName}.`, `მიიღო ${check.acceptedName}-მ და არა ${check.invitedName}-მ.`)}</span>
                <span className="gk-row">
                    <Button size="sm" disabled={busy} onClick={() => settle(check.id, 'keep', copy('Kept.', 'დატოვებულია.'))}>{copy('Keep', 'დატოვება')}</Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => settle(check.id, 'undo', copy(`Undone. ${check.acceptedName} no longer has a job here.`, `გაუქმდა. ${check.acceptedName}-ს აქ სამუშაო აღარ აქვს.`))}>{copy('Undo', 'გაუქმება')}</Button>
                </span>
            </div>)}
            {view && suggestions.length > 0 && <Section boxed title={leader ? copy('Waiting for you', 'გელოდებათ') : copy('Your suggestions', 'თქვენი შეთავაზებები')}>
                <SuggestionList suggestions={suggestions} me={view.viewer.userId} admin={leader} busy={busy} onDecide={decide} />
            </Section>}
            {view && rights.invite && activeLinks.length > 0 && <Section boxed title={copy('Staff links', 'პერსონალის ბმულები')} hint={copy('7 days or 10 people each', 'თითო 7 დღე ან 10 ადამიანი')}>
                <StaffLinkList links={activeLinks} choices={[...view.jobs, ...view.moreJobs]} onOpen={link => open('link', { link: String(link.id) })} />
            </Section>}
            {view && view.people.length > 6 && <div className="rec-toolbar"><SearchInput className="rec-toolbar__search" aria-label={copy('Find a person', 'პირის ძებნა')} value={query}
                onChange={event => setParam({ q: event.target.value || null })} placeholder={copy('Name, job or squad', 'სახელი, სამუშაო ან გუნდი')} /></div>}
            {!view ? !error && <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('Loading people', 'იტვირთება')}>{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></Panel>
                : visible.length ? <Panel flush><ul className="pp-list" aria-label={copy('People', 'ხალხი')}>{visible.map(person => <PersonRow key={person.userId}
                    club={clubId} clubName={clubName} view={view} person={person} busy={busy} link={links[person.userId]} rights={rights}
                    member={members.find(m => m.userId === person.userId)}
                    onHideLink={() => hideLink(person.userId)} onNewLink={() => makeLink(person)}
                    onAddJob={() => open('person', { for: String(person.userId) })} onEnd={job => setEnding({ person, job })} onChanged={message => refresh(message)} />)}</ul></Panel>
                    : <Panel><EmptyNote title={query ? copy('No one matches', 'ვერაფერი მოიძებნა') : copy('No one here yet', 'ჯერ არავინაა')}
                        action={!query && rights.invite ? <Button size="sm" onClick={() => open('link')}><QrCode aria-hidden="true" />{copy('Invite staff', 'პერსონალის მოწვევა')}</Button> : undefined}>
                        {query ? copy('Try a name, job or squad.', 'სცადეთ სახელი, სამუშაო ან გუნდი.') : copy('One link or QR code brings your coaches in.', 'ერთი ბმული ან QR კოდი და მწვრთნელები შემოვლენ.')}</EmptyNote></Panel>}
        </div>
        {view && rights.invite && <InviteDialog open={inviting === 'person'} club={clubId} view={view} person={forPerson} allowAdmin={inviteAdmin} onClose={() => open(null)}
            onInvited={result => {
                const added = Boolean(forPerson);
                open(null);
                showInvite(result);
                // Never say whether the address already had an account: with a link, send it; without, they find it on signing in.
                refresh(result.link ? (added ? copy('Job added. Send the new link.', 'სამუშაო დაემატა. გაგზავნეთ ახალი ბმული.') : copy(`Invited ${result.name}. Send them the link.`, `${result.name} მოწვეულია. გაუგზავნეთ ბმული.`))
                    : copy(`Invited ${result.name}. They’ll find the invitation when they sign in.`, `${result.name} მოწვეულია. მოწვევას შესვლისას ნახავს.`));
            }} />}
        {/* Opens at once: while the links load it says so; if they fail, an error line with Try again (remounted once they arrive). */}
        {view && rights.invite && inviting === 'link' && <StaffLinkDialog key={staff.links ? 'loaded' : 'waiting'} club={clubId} clubName={clubName} view={view} links={staff.links ?? []}
            loading={staff.links === null && !staff.error} loadError={staff.error} onRetry={staff.reload}
            opened={Number(params.get('link')) || null} onLinks={staff.setLinks} onClose={() => open(null)} onChanged={message => refresh(message)} />}
        {view && canSuggest && inviting === 'suggest' && <SuggestAssistantDialog club={clubId} squads={ownSquads} onClose={() => open(null)}
            onSent={message => { open(null); refresh(message); }} />}
        <Dialog open={ending !== null} role="alertdialog" size="sm" onClose={() => setEnding(null)}
            title={ending ? `${ending.person.name}: ${jobLabel(ending.job)} · ${whereLabel(ending.job)}` : ''}
            description={invited ? copy('Cancel this invitation? It can no longer be accepted.', 'გაუქმდეს მოწვევა? მისი მიღება აღარ იქნება შესაძლებელი.')
                : copy('End this job? Its tools stop now. Everything they recorded stays with the club.', 'დასრულდეს სამუშაო? ხელსაწყოები ახლავე ითიშება. ყველაფერი, რაც ჩაწერეს, კლუბს რჩება.')}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(null)}>{copy('Keep', 'დატოვება')}</Button>
                <Button variant="danger" disabled={busy} onClick={end}>{invited ? copy('Cancel invite', 'მოწვევის გაუქმება') : copy('End job', 'დასრულება')}</Button></>} />
    </PageFrame>;
}
