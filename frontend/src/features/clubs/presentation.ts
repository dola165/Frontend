import { appLocale } from '../../utils/formatting';

export type ProfileKind = 'PROFESSIONAL' | 'ACADEMY' | 'COMMUNITY';
export interface TrainingProgramme {
    id?: number; name: string; ageMin: number | null; ageMax: number | null; sessionsPerWeek: number | null;
    priceType: 'FIXED' | 'FREE' | 'VARIES' | 'UNPUBLISHED'; amount: string | null; currency: string;
    billingPeriod: 'SESSION' | 'MONTH' | 'TERM' | 'YEAR' | 'ONE_OFF';
    trialAmount: string | null; joiningFee: string | null; equipmentFee: string | null; details: string | null; published: boolean;
    squadIds?: number[]; validFrom?: string | null; validUntil?: string | null;
}
export interface ClubSponsor { id?: number; name: string; logoUrl: string | null; websiteUrl: string | null; organizationId: number | null; published: boolean; contentClassification?: string; contentRevision?: number; promotionBlocked?: boolean }
export interface AcademyAffiliation { id: number; clubId: number; name: string; logoUrl: string | null; profileKind: ProfileKind; status: 'PENDING' | 'ACTIVE'; canRespond: boolean; profileManagementEnabled?: boolean; canManageProfile?: boolean }
export interface ClubPresentation { profileKind: ProfileKind; revision: number; canEdit: boolean; canManageAffiliations?: boolean; programmes: TrainingProgramme[]; sponsors: ClubSponsor[]; affiliations: AcademyAffiliation[] }
export const profileKindLabel: Record<ProfileKind, string> = { PROFESSIONAL: 'Football club', ACADEMY: 'Football academy', COMMUNITY: 'Community football' };
export const programmeAge = (p: TrainingProgramme) => p.ageMin != null && p.ageMax != null ? `Ages ${p.ageMin}–${p.ageMax}` : p.ageMin != null ? `Ages ${p.ageMin}+` : p.ageMax != null ? `Up to age ${p.ageMax}` : 'Ask about age groups';
export const periodLabel = { SESSION: 'session', MONTH: 'month', TERM: 'term', YEAR: 'year', ONE_OFF: 'one-off' };
export const money = (amount: string, currency: string) => `${new Intl.NumberFormat(appLocale(), { maximumFractionDigits: 2 }).format(Number(amount))} ${currency}`;
export const programmePrice = (p: TrainingProgramme) => p.priceType === 'FREE' ? 'Free training'
    : p.priceType === 'VARIES' ? 'Price varies — contact the club'
    : p.priceType === 'UNPUBLISHED' || p.amount === null ? 'Price not published'
    : `${money(p.amount, p.currency)} / ${periodLabel[p.billingPeriod]}`;
export const trainingSummary = (presentation?: ClubPresentation | null) => {
    const programmes = presentation?.programmes.filter(p => p.published && p.priceType !== 'UNPUBLISHED' && currentProgramme(p)) ?? [];
    if (!programmes.length) return null;
    return programmes.length === 1 ? `${programmes[0].name}: ${programmePrice(programmes[0])}` : `Fees for ${programmes.length} training programmes`;
};
export const currentProgramme = (p: TrainingProgramme, today = new Date().toLocaleDateString('en-CA')) => (!p.validFrom || p.validFrom <= today) && (!p.validUntil || p.validUntil >= today);
export const safePublicUrl = (value?: string | null) => {
    if (!value) return undefined;
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; }
    catch { return undefined; }
};
