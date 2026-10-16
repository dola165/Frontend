import { useSearchParams } from 'react-router-dom';
import { FamilySchedule } from '../../parents/FamilySchedule';
import type * as api from '../api';

const positive = (value: string | null) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : undefined; };

/**
 * The one calendar, fixed to this squad. Coaches plan and drag sessions (with the confirmation that names who is
 * told); a parent answers for their child inside a session. `session` and `at` in the address open one session.
 */
export function SquadScheduleTab({ space, childId }: { space: api.SquadOverview; childId?: number }) {
    const [params] = useSearchParams();
    const sessionId = positive(params.get('session') ?? params.get('sessionId'));
    const at = params.get('at'), date = at && Number.isFinite(Date.parse(at)) ? new Date(at) : undefined;
    return <div className="sp-schedule"><FamilySchedule key={`${space.id}:${sessionId}:${at}`} squads={[space]} playerId={space.can_manage ? undefined : childId}
        initialSquadId={space.id} initialSessionId={sessionId} initialDate={date} inSquadPage hideContext editable={space.can_manage} /></div>;
}
