import { DoorOpen } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { LeaveClubDialog } from './LeaveClubDialog';
import { useLeaveStep } from './useLeaveStep';
import './leaving.css';

/**
 * Staff means one club (owner, 27 October 2026): where a job at another club is refused with STAFF_OF_ANOTHER_CLUB,
 * "You're staff at {club}. Leave {club} first" with Leave, the one leave flow (hand over or close included), and
 * then `onLeft` retries what was refused.
 */
export function OtherClubNotice({ club, onLeft }: { club: { clubId: number; name: string }; onLeft: () => void }) {
    const copy = useJourneyCopy();
    const { go } = useLeaveStep(club.clubId);
    const name = club.name || copy('your club', 'თქვენი კლუბი');
    return <div className="gk gk-notice gk-notice--warning lv-other" role="alert">
        <span>{copy(`You’re staff at ${name}. Leave ${name} first.`, `${name}-ის თანამშრომელი ხართ. ჯერ დატოვეთ ${name}.`)}</span>
        <Button size="sm" onClick={() => go('leave')}><DoorOpen aria-hidden="true" />{copy(`Leave ${name}`, `${name}-ის დატოვება`)}</Button>
        {/* Retried once they are no longer staff there; a handover still waiting on the other person does not count. */}
        <LeaveClubDialog clubId={club.clubId} clubName={name} onDone={(_, outcome) => { if (outcome !== 'handed') onLeft(); }} />
    </div>;
}
