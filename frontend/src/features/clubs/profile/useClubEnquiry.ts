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
        const finish = () => setParams(current => { const next = new URLSearchParams(current); next.delete('enquire'); return next; }, { replace: true });
        const programme = club.presentation?.programmes.find(p => p.published && String(p.id) === params.get('programme'));
        const squadId = params.get('squad');
        if (programme) { setEnquiry({ name: programme.name, path: `/clubs/${club.id}?tab=teams&programme=${programme.id}`, squadIds: programme.squadIds ?? [] }); finish(); }
        else if (squadId) void apiClient.get<PublicSquad[]>(`/clubs/${club.id}/squads`, { signal: controller.signal }).then(response => {
            if (controller.signal.aborted) return;
            const squad = response.data.find(s => String(s.id) === squadId);
            if (squad) setEnquiry({ name: squad.name, path: `/clubs/${club.id}?tab=teams&squad=${squad.id}`, squadIds: [squad.id] });
            finish();
        }).catch(() => { if (!controller.signal.aborted) finish(); });
        else { if (!params.get('programme')) setEnquiry({ name: club.name, path: `/clubs/${club.id}?tab=teams`, squadIds: [] }); finish(); }
        return () => controller.abort();
    }, [status, club, requested, params, setParams]);
    return [enquiry, setEnquiry] as const;
}
