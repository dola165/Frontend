import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import type { ClubEnquiryContext, PublicSquad } from '../publicJourney';
import type { ClubProfile } from './types';

/**
 * The open enquiry to the club, if any. Links with `enquire=1` (from emails, World and role pages)
 * open it once for the programme or squad they name, then the parameter is cleared.
 */
export function useClubEnquiry(club: ClubProfile | null) {
    const { status } = useAuth();
    const [params, setParams] = useSearchParams();
    const [enquiry, setEnquiry] = useState<ClubEnquiryContext | null>(null);
    const requested = params.get('enquire') === '1';
    useEffect(() => {
        if (status !== 'authenticated' || !club || !requested) return;
        const controller = new AbortController();
        void enquiryFor(club, params.get('programme'), params.get('squad'), controller.signal).then(context => {
            if (controller.signal.aborted) return;
            if (context) setEnquiry(context);
            setParams(current => { const next = new URLSearchParams(current); next.delete('enquire'); return next; }, { replace: true });
        });
        return () => controller.abort();
    }, [status, club, requested, params, setParams]);
    return [enquiry, setEnquiry] as const;
}

/** The programme, squad or general enquiry a link asks for. A programme or squad that no longer exists opens nothing. */
async function enquiryFor(club: ClubProfile, programmeId: string | null, squadId: string | null, signal: AbortSignal): Promise<ClubEnquiryContext | null> {
    const programme = club.presentation?.programmes.find(p => p.published && String(p.id) === programmeId);
    if (programme) return { name: programme.name, path: `/clubs/${club.id}?tab=teams&programme=${programme.id}`, squadIds: programme.squadIds ?? [] };
    if (squadId) {
        const squads = await apiClient.get<PublicSquad[]>(`/clubs/${club.id}/squads`, { signal }).then(response => response.data).catch(() => []);
        const squad = squads.find(s => String(s.id) === squadId);
        return squad ? { name: squad.name, path: `/clubs/${club.id}?tab=teams&squad=${squad.id}`, squadIds: [squad.id] } : null;
    }
    return programmeId ? null : { name: club.name, path: `/clubs/${club.id}?tab=teams`, squadIds: [] };
}
