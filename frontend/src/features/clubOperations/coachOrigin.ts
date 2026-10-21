import type { OperationRecord } from './api';
import { operationTab } from './workspaceNavigation';

const positiveId = (value: string | null) => value !== null && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));

/** Coach overview cards open the same authorized record, carrying a destination token rather than a return URL. */
export function coachRecordHref(club: number, record: Pick<OperationRecord, 'id' | 'module' | 'squad_id'>) {
    const query = new URLSearchParams({ tab: operationTab(record.module), record: String(record.id) });
    if (record.squad_id) {
        query.set('squad', String(record.squad_id));
        query.set('coachReturn', 'my-squads'); query.set('coachClub', String(club));
    }
    return `/clubs/${club}/workspace?${query}`;
}

/** Navigation only: current server-confirmed role scope is required; record/API rights remain authoritative. */
export function coachOriginTarget(params: URLSearchParams, club: number, assignedSquads: number[]): `/my-squads?clubId=${number}` | null {
    if (params.has('return') || params.get('from') === 'list' || !Number.isSafeInteger(club) || club <= 0) return null;
    for (const name of ['coachReturn', 'coachClub', 'record', 'squad']) if (params.getAll(name).length !== 1) return null;
    if (params.get('coachReturn') !== 'my-squads' || params.get('coachClub') !== String(club)) return null;
    const squad = params.get('squad');
    if (!positiveId(squad) || !positiveId(params.get('record')) || !assignedSquads.includes(Number(squad))) return null;
    return `/my-squads?clubId=${club}`;
}
