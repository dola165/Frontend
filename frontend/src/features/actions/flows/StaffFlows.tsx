import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog } from '../../../design/Dialog';
import { Button, Skeleton } from '../../../design/primitives';
import { refreshAccess } from '../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchPeople, linkJobs, type InviteResult, type PeopleView } from '../../clubOperations/people/api';
import { InviteStaffDialog, type InviteHow } from '../../clubOperations/people/InviteStaffDialog';
import { useStaffLinks } from '../../clubOperations/people/useStaffLinks';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** The club's Staff, which both staff flows need: who leads which squad, the jobs on offer. */
function usePeopleView(club: number) {
    const copy = useJourneyCopy();
    const [state, setState] = useState<{ club: number; view: PeopleView | null; error: string } | null>(null);
    const [round, setRound] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetchPeople(club, controller.signal).then(view => { if (!controller.signal.aborted) setState({ club, view, error: '' }); })
            .catch(failure => { if (!controller.signal.aborted) setState({ club, view: null, error: extractApiErrorMessage(failure, copy('Could not load Staff.', 'პერსონალი ვერ ჩაიტვირთა.')) }); });
        return () => controller.abort();
    }, [club, round, copy]);
    const current = state?.club === club ? state : null;
    return { view: current?.view ?? null, error: current?.error ?? '', retry: () => setRound(value => value + 1) };
}

/** While Staff loads, or when it could not: the dialog's own frame, so the door never seems dead. */
function Waiting({ title, error, retry, onClose }: { title: string; error: string; retry: () => void; onClose: () => void }) {
    const copy = useJourneyCopy();
    return <Dialog open size="md" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={error ? <Button onClick={retry}>{copy('Try again', 'თავიდან')}</Button> : undefined}>
        {error ? <p className="gk-notice gk-notice--danger" role="alert">{error}</p> : <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={120} /></div>}
    </Dialog>;
}

/** What an invite or suggestion became, said once; whether the address had an account is never said. */
function invitedNotice(result: InviteResult, copy: ReturnType<typeof useJourneyCopy>) {
    return result.status === 'SUGGESTED' ? copy(`Suggested ${result.name}. An admin confirms or declines it; you’ll be told.`, `${result.name} შეთავაზებულია. ადმინი დაადასტურებს ან უარყოფს; შეგატყობინებთ.`)
        : result.link ? copy(`Invited ${result.name}. Send them the link from Staff.`, `${result.name} მოწვეულია. ბმული პერსონალის გვერდიდან გაუგზავნეთ.`)
            : copy(`Invited ${result.name}. They’ll find the invitation when they sign in.`, `${result.name} მოწვეულია. მოწვევას შესვლისას ნახავს.`);
}

/** Invite staff over any page: the one invite, starting at the club's staff link, with the job and squad a door chose already set. */
export function InviteStaffFlow({ club, clubName, squadId, job, onClose }: { club: number; clubName: string; squadId?: number; job?: string; onClose: () => void }) {
    const copy = useJourneyCopy();
    const people = usePeopleView(club);
    const [how, setHow] = useState<InviteHow>('link');
    const staff = useStaffLinks(club, Boolean(people.view), how === 'link', copy('Could not load the staff links.', 'პერსონალის ბმულები ვერ ჩაიტვირთა.'));
    const title = copy('Invite to a job', 'სამუშაოზე მოწვევა');
    if (!people.view) return <Waiting title={title} error={people.error} retry={people.retry} onClose={onClose} />;
    const squad = people.view.squads.some(item => item.id === squadId) ? squadId : undefined;
    const linkJob = linkJobs(people.view).includes(job ?? '') ? job! : squad ? 'ASSISTANT_COACH' : 'HEAD_COACH';
    return <InviteStaffDialog key={staff.links ? 'loaded' : 'waiting'} club={club} clubName={clubName} view={people.view} suggest={false} allowAdmin={people.view.viewer.leader}
        initial={{ job: linkJob, clubWide: false, squadIds: squad ? [squad] : people.view.viewer.headCoachSquads.length === 1 ? people.view.viewer.headCoachSquads : [] }}
        how={how} onHow={setHow} links={staff.links ?? []} linksLoading={staff.links === null && !staff.error} linksError={staff.error} onRetryLinks={staff.reload}
        onLinks={staff.setLinks} onClose={onClose} onChanged={notice => { refreshAccess(); toast.success(notice); }}
        onInvited={result => { refreshAccess(); toast.success(invitedNotice(result, copy)); onClose(); }} />;
}

/** Suggest a helper over any page: the one invite for the squads the person leads (the door's squad when it named one). */
export function SuggestFlow({ club, squadId, onClose, onSent }: { club: number; squadId?: number; onClose: () => void; onSent?: (notice: string) => void }) {
    const copy = useJourneyCopy();
    const people = usePeopleView(club);
    const title = copy('Suggest a helper', 'დამხმარის შეთავაზება');
    if (!people.view) return <Waiting title={title} error={people.error} retry={people.retry} onClose={onClose} />;
    const led = people.view.squads.filter(squad => people.view!.viewer.headCoachSquads.includes(squad.id));
    if (!led.length) return <Dialog open size="sm" title={title} onClose={onClose}
        description={copy('A head coach suggests helpers for the squads they lead.', 'მთავარი მწვრთნელი დამხმარეს თავისი გუნდებისთვის სთავაზობს.')}
        footer={<Button variant="primary" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>} />;
    const squads = led.some(squad => squad.id === squadId) ? [squadId!] : led.length === 1 ? [led[0].id] : [];
    return <InviteStaffDialog club={club} clubName="" view={people.view} suggest allowAdmin={false} initial={{ job: 'ASSISTANT_COACH', clubWide: false, squadIds: squads }}
        how="person" onHow={() => undefined} links={[]} onLinks={() => undefined} onClose={onClose} onChanged={notice => toast.success(notice)}
        onInvited={result => { const notice = invitedNotice(result, copy); if (onSent) onSent(notice); else toast.success(notice); onClose(); }} />;
}
