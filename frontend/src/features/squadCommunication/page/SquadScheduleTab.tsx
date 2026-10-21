import { useSearchParams } from 'react-router-dom';
import { FamilySchedule } from '../../parents/FamilySchedule';
import { SquadTrainingSetup } from './SquadTrainingSetup';
import { useJourneyCopy } from '../journeyCopy';
import { useState } from 'react';
import { toast } from 'sonner';
import type * as api from '../api';

const positive = (value: string | null) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : undefined; };

/**
 * The one calendar, fixed to this squad. Coaches plan and drag sessions (with the confirmation that names who is
 * told); a parent answers for their child inside a session. `session` and `at` in the address open one session.
 */
export function SquadScheduleTab({ space, childId }: { space: api.SquadOverview; childId?: number }) {
    const [params, setParams] = useSearchParams();
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0), [saved, setSaved] = useState(false);
    const setup = space.can_manage && params.get('setup') === 'training';
    const closeSetup = (firstDate?: string) => { const next = new URLSearchParams(params); next.delete('setup'); if (firstDate) { next.set('at', firstDate); next.delete('session'); next.delete('sessionId'); } setParams(next, { replace: true }); };
    const sessionId = positive(params.get('session') ?? params.get('sessionId'));
    const at = params.get('at'), date = at && Number.isFinite(Date.parse(at)) ? new Date(at) : undefined;
    return <div className="sp-schedule">
        {saved && !setup && <p role="status" className="sp-quiet">{copy('Training saved. Family invitations are in the schedule.', 'ვარჯიში შენახულია. ოჯახების მოწვევები განრიგშია.')}</p>}
        {setup && <SquadTrainingSetup space={space} onClose={closeSetup} onSaved={firstDate => { closeSetup(firstDate); setSaved(true); setRevision(n => n + 1); toast.success(copy('Training saved', 'ვარჯიში შენახულია')); }} />}
        <FamilySchedule key={`${space.id}:${sessionId}:${at}:${revision}`} squads={[space]} playerId={space.can_manage ? undefined : childId}
            initialSquadId={space.id} initialSessionId={sessionId} initialDate={date} inSquadPage hideContext editable={space.can_manage} />
    </div>;
}
