import { ct } from '../store/copy';
import { Bus, Flag, HeartHandshake, LandPlot, Users, Volleyball, type LucideIcon } from 'lucide-react';
import { formatDate, formatMoney } from '../../utils/formatting';
import { apiClient } from '../../api/axiosConfig';

// ── Fundraising: a club's projects, with donations taken on GoFundMe ──
// GrassKickZ shows the fundraiser and sends supporters to the club's GoFundMe page; the club reports what came in.

export const CAMPAIGN_CATEGORIES: Array<{ value: string; label: string; line: string; icon: LucideIcon }> = [
    { value: 'EQUIPMENT', label: 'Equipment & kit', line: 'Balls, kit, goals', icon: Volleyball },
    { value: 'FACILITIES', label: 'Pitches & facilities', line: 'Pitches, lights, changing rooms', icon: LandPlot },
    { value: 'TRAVEL', label: 'Travel & competitions', line: 'Tournaments, away trips', icon: Bus },
    { value: 'YOUTH', label: 'Youth football', line: 'Bursaries, free places', icon: Users },
    { value: 'COMMUNITY', label: 'Community projects', line: 'For the whole neighbourhood', icon: HeartHandshake },
    { value: 'OTHER', label: 'Something else', line: 'Any other need', icon: Flag },
];
export const CURRENCIES = ['GEL', 'EUR', 'GBP', 'USD'] as const;
export interface CampaignUpdate { id: number; title: string; body: string; createdAt: string; }
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
    /** What the club reports as raised, on GoFundMe and elsewhere. */
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
    /** The club's GoFundMe page, where donations are taken (an https address on gofundme.com). */
    donateUrl?: string | null;
    /** The project this fundraiser is the money part of, and its squad (the project's); step 4. */
    projectId?: number;
    squadId?: number | null;
    /** Who last reported the amount, and who published first (the first one counts). */
    reportedBy?: number | null;
    publishedBy?: number | null;
    /** How many people have given. Backend field to add. */
    donations?: number | null;
    /** How far the club is from the area the list was asked for; only lists carry it. */
    distanceKm?: number | null;
}
export type CampaignInput = Pick<Campaign, 'title' | 'summary' | 'description' | 'beneficiary' | 'useOfFunds' | 'category' | 'currency' | 'goalAmount' | 'reportedAmount' | 'reportedNote' | 'startsOn' | 'endsOn' | 'images'> & { version?: number; donateUrl?: string | null };
export type CampaignState = 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
export type CampaignSort = 'RELEVANCE' | 'NEWEST' | 'ENDING' | 'RAISED' | 'CLOSEST';
export interface CampaignQuery { page?: number; size?: number; clubId?: number; query?: string; category?: string; country?: string; city?: string; state?: string; sort?: CampaignSort; near?: string; }
export interface CampaignPage { content: Campaign[]; totalElements: number }

export const fetchCampaigns = async (params: CampaignQuery, signal?: AbortSignal) => (await apiClient.get<CampaignPage>('/campaigns', { params, signal })).data;
export const fetchCampaign = async (id: number, signal?: AbortSignal) => (await apiClient.get<Campaign>(`/campaigns/${id}`, { signal })).data;
export const fetchCampaignLocations = async (clubId?: number, signal?: AbortSignal) => (await apiClient.get<{ country: string; city: string | null }[]>('/campaigns/locations', { params: { clubId }, signal })).data;
/** The fundraising front page in one request: GET /campaigns/front?near=City. */
export interface FundraisingFront { city: string | null; near: Campaign[]; closest: Campaign[]; followed: Campaign[]; fresh: Campaign[]; active: number; raised: number }
export const fetchFundraisingFront = async (near: string | undefined, signal?: AbortSignal) => (await apiClient.get<FundraisingFront>('/campaigns/front', { params: { near }, signal })).data;

// ── A club's own fundraisers ──
export const fetchManagedCampaigns = async (club: number, signal?: AbortSignal) => (await apiClient.get<Campaign[]>(`/clubs/${club}/campaigns`, { signal })).data;
export const fetchManagedCampaign = async (club: number, id: number, signal?: AbortSignal) => (await apiClient.get<Campaign>(`/clubs/${club}/campaigns/${id}`, { signal })).data;
export const createCampaign = async (club: number, input: CampaignInput, idempotencyKey?: string) =>
    (await apiClient.post<Campaign>(`/clubs/${club}/campaigns`, input, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined)).data;
const commandHeaders = (key?: string) => key ? { headers: { 'Idempotency-Key': key } } : undefined;
export const editCampaign = async (club: number, id: number, input: CampaignInput, key?: string) => (await apiClient.put<Campaign>(`/clubs/${club}/campaigns/${id}`, input, commandHeaders(key))).data;
export const changeCampaignState = async (club: number, campaign: Campaign, status: CampaignState, key?: string) =>
    (await apiClient.post<Campaign>(`/clubs/${club}/campaigns/${campaign.id}/state`, { version: campaign.version, status }, commandHeaders(key))).data;
export const postCampaignUpdate = async (club: number, campaign: Campaign, title: string, body: string, key?: string) =>
    (await apiClient.post<Campaign>(`/clubs/${club}/campaigns/${campaign.id}/updates`, { version: campaign.version, title, body }, commandHeaders(key))).data;

export const campaignCategory = (value: string) => ct(CAMPAIGN_CATEGORIES.find(c => c.value === value)?.label) ?? ct("Fundraiser");
export const campaignPhase = (value: string) => ({ DRAFT: ct("Draft"), ACTIVE: ct("Active"), SCHEDULED: ct("Starts soon"), ENDED: ct("Ended"), PAUSED: ct("Paused"), CLOSED: ct("Closed"), ARCHIVED: ct("Archived") })[value] ?? value;
export const campaignMoney = formatMoney;
export const campaignDate = (value: string) => formatDate(value);
/**
 * How far a fundraiser is: raised, goal, the share as a whole number, and how many gave. `raised` stays null while the
 * club has reported nothing (never shown as zero raised, nor zero donations); a reported zero is a zero.
 */
export const progressOf = (campaign: Campaign) => {
    const raised = campaign.reportedAmount ?? null, goal = campaign.goalAmount ?? null;
    return { raised, goal, percent: goal && raised !== null ? Math.min(100, Math.max(0, Math.round(raised / goal * 100))) : null, donations: raised === null ? null : campaign.donations ?? null, reached: !!goal && raised !== null && raised >= goal };
};
/** Days left before the fundraiser ends; null without an end date, 0 once it has passed. */
export const daysLeft = (campaign: Campaign) => campaign.endsOn ? Math.max(0, Math.ceil((Date.parse(campaign.endsOn) - Date.now()) / 86_400_000)) : null;
