import { formatDate, formatMoney } from '../../utils/formatting';
import { apiClient } from '../../api/axiosConfig';
export const CAMPAIGN_CATEGORIES = [
    { value: 'EQUIPMENT', label: 'Equipment & kit' },
    { value: 'FACILITIES', label: 'Pitches & facilities' },
    { value: 'TRAVEL', label: 'Travel & competitions' },
    { value: 'YOUTH', label: 'Youth football' },
    { value: 'COMMUNITY', label: 'Community projects' },
    { value: 'OTHER', label: 'Other campaigns' },
] as const;
export const CURRENCIES = ['GEL', 'EUR', 'GBP', 'USD'] as const;
export interface CampaignUpdate {
    id: number;
    title: string;
    body: string;
    createdAt: string;
}
export interface Campaign {
    id: number;
    clubId: number;
    clubName: string;
    clubLogoUrl?: string;
    country?: string;
    city?: string;
    title: string;
    summary: string;
    description: string;
    beneficiary: string;
    useOfFunds: string;
    category: string;
    currency: string;
    goalAmount: number | null;
    reportedAmount: number | null;
    reportedNote: string;
    reportedAt: string | null;
    startsOn: string | null;
    endsOn: string | null;
    images: string[];
    status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
    phase: string;
    version: number;
    updatedAt: string;
    publishedAt: string | null;
    updates: CampaignUpdate[];
}
export type CampaignInput = Pick<
    Campaign,
    | 'title'
    | 'summary'
    | 'description'
    | 'beneficiary'
    | 'useOfFunds'
    | 'category'
    | 'currency'
    | 'goalAmount'
    | 'reportedAmount'
    | 'reportedNote'
    | 'startsOn'
    | 'endsOn'
    | 'images'
> & { version?: number };
export type CampaignState = 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
export interface CampaignQuery {
    page?: number;
    size?: number;
    clubId?: number;
    query?: string;
    category?: string;
    currency?: string;
    country?: string;
    city?: string;
    state?: string;
    sort?: string;
}
export const fetchCampaigns = async (params: CampaignQuery, signal?: AbortSignal) =>
    (await apiClient.get<{ content: Campaign[]; totalElements: number }>('/campaigns', { params, signal }))
        .data;
export const fetchCampaign = async (id: number, signal?: AbortSignal) =>
    (await apiClient.get<Campaign>(`/campaigns/${id}`, { signal })).data;
export const fetchCampaignLocations = async (clubId?: number, signal?: AbortSignal) =>
    (
        await apiClient.get<{ country: string; city: string | null }[]>('/campaigns/locations', {
            params: { clubId },
            signal,
        })
    ).data;
export const fetchManagedCampaigns = async (club: number, signal?: AbortSignal) =>
    (await apiClient.get<Campaign[]>(`/clubs/${club}/campaigns`, { signal })).data;
export const fetchManagedCampaign = async (club: number, id: number, signal?: AbortSignal) =>
    (await apiClient.get<Campaign>(`/clubs/${club}/campaigns/${id}`, { signal })).data;
export const createCampaign = async (club: number, input: CampaignInput) =>
    (await apiClient.post<Campaign>(`/clubs/${club}/campaigns`, input)).data;
export const editCampaign = async (club: number, id: number, input: CampaignInput) =>
    (await apiClient.put<Campaign>(`/clubs/${club}/campaigns/${id}`, input)).data;
export const changeCampaignState = async (club: number, campaign: Campaign, status: CampaignState) =>
    (
        await apiClient.post<Campaign>(`/clubs/${club}/campaigns/${campaign.id}/state`, {
            version: campaign.version,
            status,
        })
    ).data;
export const postCampaignUpdate = async (club: number, campaign: Campaign, title: string, body: string) =>
    (
        await apiClient.post<Campaign>(`/clubs/${club}/campaigns/${campaign.id}/updates`, {
            version: campaign.version,
            title,
            body,
        })
    ).data;
export const campaignCategory = (value: string) =>
    CAMPAIGN_CATEGORIES.find((c) => c.value === value)?.label ?? 'Campaign';
export const campaignPhase = (value: string) =>
    ({
        DRAFT: 'Draft',
        ACTIVE: 'Active',
        SCHEDULED: 'Starts soon',
        ENDED: 'Ended',
        PAUSED: 'Paused',
        CLOSED: 'Closed',
        ARCHIVED: 'Archived',
    })[value] ?? value;
export const campaignMoney = formatMoney;
export const campaignDate = (value: string) => formatDate(value);
