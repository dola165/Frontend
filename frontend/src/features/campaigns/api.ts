import { ct } from '../store/copy';
import { Bus, Flag, HeartHandshake, LandPlot, Users, Volleyball, type LucideIcon } from 'lucide-react';
import { formatDate, formatMoney } from '../../utils/formatting';
import { apiClient } from '../../api/axiosConfig';

// One public appeal, organizer-reported progress, and an external/contact giving handoff.

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
    clubId: number | null;
    clubName: string;
    publisher?: { kind: 'CLUB' | 'PERSON'; userId: number | null; name: string; profilePath: string };
    history?: CampaignHistory[];
    publicationRestricted?: boolean;
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
    /** How far the club is from the area the list was asked for; only lists carry it. */
    distanceKm?: number | null;
}
export interface CampaignHistory { version: number; status: string; currency: string; goalAmount: number | null; reportedAmount: number | null; reportedNote: string; reportedAt: string | null; recordedAt: string; attribution: string }
export const organizerName = (c: Campaign) => c.publisher?.name ?? c.clubName;
export const organizerPath = (c: Campaign) => c.publisher?.profilePath ?? `/clubs/${c.clubId}`;
export const isPersonal = (c: Campaign) => c.publisher?.kind === 'PERSON';
/** Syntax only: this never certifies provider/country/beneficiary eligibility. */
export const safeGivingUrl = (value?: string | null) => {
    if (!value || value.length > 500 || !/^https:\/\/([a-z0-9-]+\.)*gofundme\.com(\/\S*)?$/i.test(value)
        || /[\\\s]/.test(value) || [...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && (url.hostname === 'gofundme.com' || url.hostname.endsWith('.gofundme.com')) ? value : null; } catch { return null; }
};
export type CampaignSort = 'RELEVANCE' | 'NEWEST' | 'ENDING' | 'RAISED' | 'CLOSEST';
export interface CampaignQuery { page?: number; size?: number; clubId?: number; query?: string; category?: string; country?: string; city?: string; state?: string; sort?: CampaignSort; near?: string; }
export interface CampaignPage { content: Campaign[]; totalElements: number }

export const fetchCampaigns = async (params: CampaignQuery, signal?: AbortSignal) => (await apiClient.get<CampaignPage>('/campaigns', { params, signal })).data;
export const fetchCampaign = async (id: number, signal?: AbortSignal) => (await apiClient.get<Campaign>(`/campaigns/${id}`, { signal })).data;
export const fetchCampaignLocations = async (clubId?: number, signal?: AbortSignal) => (await apiClient.get<{ country: string; city: string | null }[]>('/campaigns/locations', { params: { clubId }, signal })).data;
/** The fundraising front page in one request: GET /campaigns/front?near=City. */
export interface FundraisingFront { city: string | null; near: Campaign[]; closest: Campaign[]; followed: Campaign[]; fresh: Campaign[]; active: number; raised: number | null }
export const fetchFundraisingFront = async (near: string | undefined, signal?: AbortSignal) => (await apiClient.get<FundraisingFront>('/campaigns/front', { params: { near }, signal })).data;

// A club's own fundraisers are a project's money part: features/projects/api.ts manages them.

export const campaignCategory = (value: string) => ct(CAMPAIGN_CATEGORIES.find(c => c.value === value)?.label) ?? ct("Fundraiser");
export const campaignPhase = (value: string) => ({ PUBLISHED: ct("Published"), DRAFT: ct("Draft"), ACTIVE: ct("Active"), SCHEDULED: ct("Starts soon"), ENDED: ct("Ended"), PAUSED: ct("Paused"), CLOSED: ct("Closed"), ARCHIVED: ct("Archived") })[value] ?? value;
export const campaignMoney = formatMoney;
export const campaignDate = (value: string) => formatDate(value);
/**
 * How far a fundraiser is: raised, goal, the share as a whole number, and how many gave. `raised` stays null while the
 * club has reported nothing (never shown as zero raised, nor zero donations); a reported zero is a zero.
 */
export const progressOf = (campaign: Campaign) => {
    const raised = campaign.reportedAmount ?? null, goal = campaign.goalAmount ?? null;
    return { raised, goal, percent: goal && raised !== null ? Math.min(100, Math.max(0, Math.round(raised / goal * 100))) : null, donations: null, reached: !!goal && raised !== null && raised >= goal };
};
/** Days left before the fundraiser ends; null without an end date, 0 once it has passed. */
export const daysLeft = (campaign: Campaign) => campaign.endsOn ? Math.max(0, Math.ceil((Date.parse(campaign.endsOn) - Date.now()) / 86_400_000)) : null;

export type CampaignInput = Pick<Campaign, 'title' | 'summary' | 'description' | 'beneficiary' | 'useOfFunds' | 'category' | 'currency' | 'goalAmount' | 'reportedAmount' | 'reportedNote' | 'startsOn' | 'endsOn' | 'images' | 'donateUrl'> & { version?: number };
export const fetchPersonalCampaigns = async (signal?: AbortSignal) => (await apiClient.get<Campaign[]>('/fundraising/mine', { signal })).data;
export const fetchPersonalCampaign = async (id: number, signal?: AbortSignal) => (await apiClient.get<Campaign>(`/fundraising/mine/${id}`, { signal })).data;
export const savePersonalCampaign = async (id: number | null, input: CampaignInput, requestId: string) =>
    (await apiClient.request<Campaign>({ method: id ? 'PUT' : 'POST', url: `/fundraising/mine${id ? '/' + id : ''}`, data: input, headers: { 'X-Request-Id': requestId } })).data;
export const createClubCampaign = async (club: number, input: CampaignInput, requestId: string) =>
    (await apiClient.post<Campaign>(`/fundraising/clubs/${club}`, input, { headers: { 'X-Request-Id': requestId } })).data;
export const movePersonalCampaign = async (id: number, version: number, status: string, publicationConsent: boolean, requestId: string) =>
    (await apiClient.post<Campaign>(`/fundraising/mine/${id}/state`, { version, status, publicationConsent }, { headers: { 'X-Request-Id': requestId } })).data;
export const postPersonalUpdate = async (id: number, version: number, title: string, body: string, requestId: string) =>
    (await apiClient.post<Campaign>(`/fundraising/mine/${id}/updates`, { version, title, body }, { headers: { 'X-Request-Id': requestId } })).data;

export const fetchFundraisingClubs = async (signal?: AbortSignal) => (await apiClient.get<{ id: number; name: string }[]>('/fundraising/clubs', { signal })).data;
