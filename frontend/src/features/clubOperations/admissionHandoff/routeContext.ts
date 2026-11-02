import type { AuthSessionId } from '../../../utils/authStorage';
import type { HandoffScope } from './api';

/** MAIN supplies the existing tool's unprefixed/scoped parameters and authenticated bootstrap. */
export function admissionHandoffFromParams(params: URLSearchParams, actor: { clubId: number; actorId: number }, sessionId: AuthSessionId):
    { state: 'absent' } | { state: 'invalid' } | { state: 'ready'; scope: HandoffScope } {
    const id = params.get('admissionCase'), version = params.get('admissionVersion');
    if (id === null && version === null) return { state: 'absent' };
    if (params.getAll('admissionCase').length !== 1 || params.getAll('admissionVersion').length !== 1
        || !id || !version || !/^[1-9]\d*$/.test(id) || !/^\d+$/.test(version)
        || !Number.isSafeInteger(Number(id)) || !Number.isSafeInteger(Number(version))) return { state: 'invalid' };
    return { state: 'ready', scope: { ...actor, caseId: Number(id), caseVersion: Number(version), sessionId } };
}

export function withoutAdmissionHandoff(params: URLSearchParams) {
    const next = new URLSearchParams(params);
    next.delete('admissionCase'); next.delete('admissionVersion');
    return next;
}
