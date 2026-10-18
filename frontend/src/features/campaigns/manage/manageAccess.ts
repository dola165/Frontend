import { useAuth } from '../../../context/AuthContext';
import { isLeadershipRole } from '../../clubs/domain';
import { fetchStoreClub } from '../../store/api';
import { useWorldData } from '../../world/useWorldData';

/** Whether the signed-in person manages this club's fundraisers (the club's staff, as for starting one). */
export function useFundraiserAccess(clubId: number | null | undefined) {
    const { status, user } = useAuth();
    const club = useWorldData(clubId && status === 'authenticated' ? `store-club:${user?.id ?? ''}:${clubId}` : null, signal => fetchStoreClub(clubId!, signal));
    return { ...club, loading: status === 'bootstrapping' || club.loading, allowed: status === 'authenticated' && !club.loading && !club.error && isLeadershipRole(club.data?.myRole) };
}

export const useManagesFundraisers = (clubId: number | null | undefined) => useFundraiserAccess(clubId).allowed;

export type FundraiserTool = 'report' | 'update' | 'edit';
/** Where a tool for one fundraiser opens; the link's state says where it returns. */
export const manageToolPath = (campaignId: number, tool: FundraiserTool) => `/campaigns/${campaignId}/manage/${tool}`;
