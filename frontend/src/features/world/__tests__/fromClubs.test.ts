import { expect, it } from 'vitest';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import type { Campaign } from '../../campaigns/api';
import type { StoreProduct } from '../../store/api';
import { mixOffers } from '../front/fromClubs';

const product = (id: number, clubId: number, createdAt: string, over: Partial<StoreProduct> = {}): StoreProduct => ({ id, clubId, name: `P${id}`, createdAt, active: true, ...over });
const campaign = (id: number, clubId: number, endsOn: string, over: Partial<Campaign> = {}) => ({ id, clubId, endsOn, status: 'PUBLISHED', title: `C${id}`, ...over }) as Campaign;
const club = (id: number, sponsors: object[]) => ({ id, name: `Club ${id}`, logoUrl: null, presentation: { sponsors } }) as unknown as ClubProfile;
const sponsor = (id: number, over: object = {}) => ({ id, name: `S${id}`, logoUrl: null, websiteUrl: null, organizationId: null, published: true, ...over });

it('never shows unpublished, blocked or restricted sponsors, ended fundraisers or inactive products', () => {
    const offers = mixOffers({
        products: [product(1, 1, '2026-10-01', { active: false })],
        campaigns: [campaign(1, 1, '2026-10-01'), campaign(2, 1, '2026-12-01', { status: 'DRAFT' })],
        clubs: [club(1, [sponsor(1, { published: false }), sponsor(2, { promotionBlocked: true }), sponsor(3, { contentClassification: 'RESTRICTED' })])],
    }, { today: '2026-10-11' });
    expect(offers).toEqual([]);
});

it('puts my own and followed clubs first, then takes turns: fundraiser, shop, sponsor', () => {
    const offers = mixOffers({
        products: [product(1, 2, '2026-10-09'), product(2, 1, '2026-10-01'), product(3, 2, '2026-10-08'), product(4, 2, '2026-10-07')],
        campaigns: [campaign(1, 2, '2026-10-20'), campaign(2, 1, '2026-11-30')],
        clubs: [club(2, [sponsor(5)]), club(1, [sponsor(6), sponsor(7)]), club(3, [sponsor(8)])],
    }, { near: new Set([1]), today: '2026-10-11' });
    expect(offers.map(offer => offer.id)).toEqual(['fundraiser:2', 'shop:2', 'sponsor:1:6', 'fundraiser:1', 'shop:1', 'sponsor:2:5', 'shop:3']);
});

it('stops at eight tiles', () => {
    const offers = mixOffers({ products: Array.from({ length: 20 }, (_, index) => product(index, index, '2026-10-01')), campaigns: [], clubs: [] });
    expect(offers).toHaveLength(8);
});
