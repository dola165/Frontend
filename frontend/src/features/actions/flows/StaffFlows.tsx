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

/** What an invite became, said once; whether the address had an account is never said. */
function invitedNotice(result: InviteResult, copy: ReturnType<typeof useJourneyCopy>) {
    return result.link ? copy(`Invited ${result.name}. Send them the link from Staff.`, `${result.name} მოწვეულია. ბმული პერსონალის გვერდიდან გაუგზავნეთ.`)
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
    return <InviteStaffDialog club={club} clubName={clubName} view={people.view} allowAdmin={people.view.viewer.leader}
        initial={{ job: linkJob, clubWide: false, squadIds: squad ? [squad] : people.view.viewer.headCoachSquads.length === 1 ? people.view.viewer.headCoachSquads : [] }}
        how={how} onHow={setHow} links={staff.links ?? []} linksLoading={staff.links === null && !staff.error} linksError={staff.error} onRetryLinks={staff.reload}
        onLinks={staff.setLinks} onClose={onClose} onChanged={notice => { refreshAccess(); toast.success(notice); }}
        onInvited={result => { refreshAccess(); toast.success(invitedNotice(result, copy)); onClose(); }} />;
}
