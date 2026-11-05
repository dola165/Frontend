import type { AdmissionInquiry, InquiryCommand } from '../admissions/types';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { assertCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';

const positive = (value: string | null) => value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
export function scoutingFamilyPath(club: number, record: number, inquiry: number, params: URLSearchParams) {
    const query = new URLSearchParams({ details: '1', tab: 'conversation', scoutingClub: String(club), scoutingRecord: String(record) });
    for (const key of ['squad', 'view', 'page', 'q']) if (params.has(key)) query.set('scouting_' + key, params.get(key)!);
    return `/admissions/inquiries/${inquiry}?${query}`;
}
export function scoutingFamilyContext(params: URLSearchParams) {
    if (![...params.keys()].some(key => key.startsWith('scouting'))) return null;
    const club = positive(params.get('scoutingClub')), record = positive(params.get('scoutingRecord'));
    if (!club || !record) return { invalid: true } as const;
    const back = new URLSearchParams({ tab: 'tools', tool: 'scouting', prospect: String(record) });
    for (const key of ['squad', 'view', 'page', 'q']) if (params.has('scouting_' + key)) back.set(key, params.get('scouting_' + key)!);
    return { club, record, back: `/clubs/${club}/office?${back}` };
}
export type FamilyContext = Exclude<ReturnType<typeof scoutingFamilyContext>, null | { invalid: true }>;

/** Existing inquiry reader/command, behind current scouting provenance on every read and replay. */
export function scoutingFamilyApi(context: FamilyContext, inquiry: number, session: AuthSessionId) {
    const root = `/clubs/${context.club}/scouting/${context.record}/applications/${inquiry}`;
    const config = (signal?: AbortSignal): AuthSessionRequestConfig => ({ _authSessionId: session, signal });
    return {
        read: async (signal?: AbortSignal) => {
            assertCurrentAuthSession(session);
            const result = await apiClient.get<AdmissionInquiry>(root, config(signal));
            assertCurrentAuthSession(session); return result.data;
        },
        command: async (body: InquiryCommand) => {
            assertCurrentAuthSession(session);
            const result = await apiClient.post<AdmissionInquiry>(root + '/commands', body, config());
            assertCurrentAuthSession(session); return result.data;
        },
    };
}
