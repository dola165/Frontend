import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { fetchCampaigns, type Campaign } from '../../campaigns/api';
import type { ClubSponsor } from '../../clubs/presentation';
import { fetchStoreCatalogPage, type StoreProduct } from '../../store/api';
import { fetchClubDirectory } from '../api';
import { isoDay } from '../format';
import { useWorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import { useWorldSession } from '../worldSession';

/** One thing a club offers on the rail: a fundraiser, something from its shop, or a sponsor it publishes. */
export type Offer =
    | { kind: 'fundraiser'; id: string; campaign: Campaign }
    | { kind: 'shop'; id: string; product: StoreProduct }
    | { kind: 'sponsor'; id: string; sponsor: ClubSponsor; club: Pick<ClubProfile, 'id' | 'name' | 'logoUrl'> };

/** A sponsor may be shown when the club publishes it and review has not blocked or restricted it. */
export const promotable = (sponsor: ClubSponsor) => sponsor.published && !sponsor.promotionBlocked && sponsor.contentClassification !== 'RESTRICTED';

/**
 * The rail's order, never paid for: what is shown, and in what order. My own and followed clubs come first, then
 * the newest products, the fundraisers ending soonest and the biggest clubs' sponsors. At most two products per
 * club, one sponsor per club and two sponsors in all. Fundraiser, shop and sponsor take turns, up to eight tiles.
 */
export function mixOffers({ products, campaigns, clubs }: { products: StoreProduct[]; campaigns: Campaign[]; clubs: ClubProfile[] },
    { near = new Set<number>(), today = isoDay(0), max = 8 }: { /** My own and followed clubs. */ near?: Set<number>; today?: string; max?: number } = {}): Offer[] {
    const first = (clubId: number | null | undefined) => clubId != null && near.has(clubId) ? 0 : 1;
    const perClub = new Map<number, number>();
    const shop = products.filter(product => product.active !== false && product.name)
        .sort((a, b) => first(a.clubId) - first(b.clubId) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .filter(product => { const count = perClub.get(product.clubId ?? -1) ?? 0; perClub.set(product.clubId ?? -1, count + 1); return count < 2; })
        .map((product): Offer => ({ kind: 'shop', id: `shop:${product.id}`, product }));
    const fundraisers = campaigns.filter(campaign => campaign.status === 'PUBLISHED' && (!campaign.endsOn || campaign.endsOn >= today))
        .sort((a, b) => first(a.clubId) - first(b.clubId) || (a.endsOn ?? '9999').localeCompare(b.endsOn ?? '9999'))
        .map((campaign): Offer => ({ kind: 'fundraiser', id: `fundraiser:${campaign.id}`, campaign }));
    const sponsors = clubs.map((club, index) => ({ club, index })).sort((a, b) => first(a.club.id) - first(b.club.id) || a.index - b.index)
        .flatMap(({ club }) => { const sponsor = (club.presentation?.sponsors ?? []).find(promotable); return sponsor ? [{ kind: 'sponsor' as const, id: `sponsor:${club.id}:${sponsor.id ?? sponsor.name}`, sponsor, club: { id: club.id, name: club.name, logoUrl: club.logoUrl } }] : []; })
        .slice(0, 2);
    const queues = [fundraisers, shop, sponsors], mixed: Offer[] = [];
    for (let turn = 0; mixed.length < max && queues.some(queue => queue.length); turn++) {
        const next = queues[turn % queues.length].shift();
        if (next) mixed.push(next);
    }
    return mixed;
}

/** What clubs in the area offer, mixed for the rail. Any source that fails is left out rather than failing the rail. */
export function useFromClubs(area: WorldArea) {
    const { membership } = useWorldSession();
    const own = membership?.clubId ? Number(membership.clubId) : null;
    const data = useWorldData(area.ready ? `from-clubs:${area.city}` : null, async signal => {
        const [products, campaigns, clubs] = await Promise.allSettled([
            fetchStoreCatalogPage(0, 12, undefined, { city: area.city, sort: 'NEWEST' }, signal).then(page => page.content),
            fetchCampaigns({ city: area.city, page: 0, size: 8, sort: 'ENDING' }, signal).then(page => page.content),
            fetchClubDirectory(new URLSearchParams({ city: area.city, sort: 'MEMBER_COUNT', page: '0', size: '12' }), signal).then(page => page.content),
        ]);
        const value = <T,>(result: PromiseSettledResult<T[]>) => result.status === 'fulfilled' ? result.value : [];
        if ([products, campaigns, clubs].every(result => result.status === 'rejected')) throw (products as PromiseRejectedResult).reason;
        return { products: value(products), campaigns: value(campaigns), clubs: value(clubs) };
    });
    const near = new Set([...(own ? [own] : []), ...(data.data?.clubs ?? []).filter(club => club.isFollowedByMe).map(club => club.id)]);
    return { ...data, items: data.data ? mixOffers(data.data, { near }) : [] };
}
