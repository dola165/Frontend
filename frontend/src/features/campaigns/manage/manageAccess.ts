import { useAuth } from '../../../context/AuthContext';
import { canManageClubOperations } from '../../clubs/domain';
import { fetchStoreClub } from '../../store/api';
import { useWorldData } from '../../world/useWorldData';

/** Whether the signed-in person manages this club's fundraisers (the club's staff, as for starting one). */
export function useManagesFundraisers(clubId: number | null | undefined) {
    const { status } = useAuth();
    const club = useWorldData(clubId ? `store-club:${clubId}` : null, signal => fetchStoreClub(clubId!, signal));
    return status === 'authenticated' && canManageClubOperations(club.data?.myRole);
}

export type FundraiserTool = 'report' | 'update' | 'edit';
/** Where a tool for one fundraiser opens; the link's state says where it returns. */
export const manageToolPath = (campaignId: number, tool: FundraiserTool) => `/campaigns/${campaignId}/manage/${tool}`;
