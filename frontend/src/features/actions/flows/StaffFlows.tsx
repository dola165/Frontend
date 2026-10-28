import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog } from '../../../design/Dialog';
import { Button, Skeleton } from '../../../design/primitives';
import { refreshAccess } from '../../../hooks/useCan';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchPeople, linkJobs, type PeopleView } from '../../clubOperations/people/api';
import { StaffLinkDialog } from '../../clubOperations/people/StaffLinkDialog';
import { SuggestAssistantDialog } from '../../clubOperations/people/SuggestAssistantDialog';
import { useStaffLinks } from '../../clubOperations/people/useStaffLinks';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** The club's People, which both staff flows need: who leads which squad, the jobs on offer. */
function usePeopleView(club: number) {
    const copy = useJourneyCopy();
    const [state, setState] = useState<{ club: number; view: PeopleView | null; error: string } | null>(null);
    const [round, setRound] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetchPeople(club, controller.signal).then(view => { if (!controller.signal.aborted) setState({ club, view, error: '' }); })
            .catch(failure => { if (!controller.signal.aborted) setState({ club, view: null, error: extractApiErrorMessage(failure, copy('Could not load People.', 'ხალხი ვერ ჩაიტვირთა.')) }); });
        return () => controller.abort();
    }, [club, round, copy]);
    const current = state?.club === club ? state : null;
    return { view: current?.view ?? null, error: current?.error ?? '', retry: () => setRound(value => value + 1) };
}

/** While People loads, or when it could not: the dialog's own frame, so the door never seems dead. */
function Waiting({ title, error, retry, onClose }: { title: string; error: string; retry: () => void; onClose: () => void }) {
    const copy = useJourneyCopy();
    return <Dialog open size="md" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={error ? <Button onClick={retry}>{copy('Try again', 'თავიდან')}</Button> : undefined}>
        {error ? <p className="gk-notice gk-notice--danger" role="alert">{error}</p> : <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={120} /></div>}
    </Dialog>;
}

/** Invite staff over any page: the club's staff link and QR, the job and squad a door chose already set. */
export function InviteStaffFlow({ club, clubName, squadId, job, onClose }: { club: number; clubName: string; squadId?: number; job?: string; onClose: () => void }) {
    const copy = useJourneyCopy();
    const people = usePeopleView(club);
    const staff = useStaffLinks(club, Boolean(people.view), true, copy('Could not load the staff links.', 'პერსონალის ბმულები ვერ ჩაიტვირთა.'));
    const title = copy('Invite staff', 'პერსონალის მოწვევა');
    if (!people.view) return <Waiting title={title} error={people.error} retry={people.retry} onClose={onClose} />;
    const squad = people.view.squads.some(item => item.id === squadId) ? squadId : undefined;
    const linkJob = linkJobs(people.view).includes(job ?? '') ? job! : squad ? 'ASSISTANT_COACH' : 'HEAD_COACH';
    return <StaffLinkDialog key={staff.links ? 'loaded' : 'waiting'} club={club} clubName={clubName} view={people.view} links={staff.links ?? []}
        loading={staff.links === null && !staff.error} loadError={staff.error} onRetry={staff.reload}
        initial={{ job: linkJob, clubWide: false, squadIds: squad ? [squad] : people.view.viewer.headCoachSquads.length === 1 ? people.view.viewer.headCoachSquads : [] }}
        onLinks={staff.setLinks} onClose={onClose} onChanged={notice => { refreshAccess(); toast.success(notice); }} />;
}

/** Suggest an assistant over any page: for the squads the person leads (the door's squad when it named one). */
export function SuggestFlow({ club, squadId, onClose }: { club: number; squadId?: number; onClose: () => void }) {
    const copy = useJourneyCopy();
    const people = usePeopleView(club);
    const title = copy('Suggest an assistant', 'ასისტენტის შეთავაზება');
    if (!people.view) return <Waiting title={title} error={people.error} retry={people.retry} onClose={onClose} />;
    const led = people.view.squads.filter(squad => people.view!.viewer.headCoachSquads.includes(squad.id));
    const squads = led.some(squad => squad.id === squadId) ? led.filter(squad => squad.id === squadId) : led;
    if (!squads.length) return <Dialog open size="sm" title={title} onClose={onClose}
        description={copy('A head coach suggests helpers for the squads they lead.', 'მთავარი მწვრთნელი დამხმარეს თავისი გუნდებისთვის სთავაზობს.')}
        footer={<Button variant="primary" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>} />;
    return <SuggestAssistantDialog club={club} squads={squads} onClose={onClose} onSent={notice => { toast.success(notice); onClose(); }} />;
}
