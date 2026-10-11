import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MediaImage } from '../../../../components/ui/MediaImage';
import { EmptyNote } from '../../../../design/primitives';
import { ProgressRing } from '../../../../design/visuals';
import { resolveMediaUrl } from '../../../../utils/resolveMediaUrl';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { daysUntil } from '../../format';
import { useFromClubs, type Offer } from '../fromClubs';
import { Cluster, WorldField } from '../WorldField';
import type { FieldProps } from './fieldProps';
import './from-clubs.css';

const host = (url: string) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; } };

/** One tile: what kind of thing it is (always labelled), its picture, its title, the club, and one fact. */
function Tile({ label, image, contain, title, club, fact }: { label: string; image?: string | null; contain?: boolean; title: string; club: { name: string; logo?: string | null }; fact: ReactNode }) {
    const src = resolveMediaUrl(image);
    return <>
        <span className="gk-offer__media" data-contain={contain || undefined}>
            {src ? <MediaImage src={src} alt="" loading="lazy" /> : <Crest name={club.name} src={club.logo} size={48} />}
            <span className="gk-offer__label">{label}</span>
        </span>
        <span className="gk-offer__title">{title}</span>
        <span className="gk-offer__club"><Crest src={club.logo} name={club.name} size={18} round /><span>{club.name}</span></span>
        <span className="gk-offer__fact">{fact}</span>
    </>;
}

/** A tile for each kind of offer: fundraisers and shop items open inside the app; a sponsor opens its own site, marked as sponsored. */
function OfferTile({ offer }: { offer: Offer }) {
    const t = useWorldCopy();
    if (offer.kind === 'fundraiser') {
        const { campaign } = offer, share = campaign.goalAmount && campaign.reportedAmount != null ? Math.round(campaign.reportedAmount / campaign.goalAmount * 100) : null, left = daysUntil(campaign.endsOn);
        return <Link className="gk-offer" to={`/campaigns/${campaign.id}`}>
            <Tile label={t('Fundraiser')} image={campaign.images[0]} title={campaign.title} club={{ name: campaign.clubName, logo: campaign.clubLogoUrl }}
                fact={share != null ? <><ProgressRing value={Math.min(share, 100)} total={100} size={28} /><span>{t('{share}% of goal, as the club reports', { share })}{left != null && left >= 0 ? ` · ${t('{count} days left', { count: left })}` : ''}</span></>
                    : left != null && left >= 0 ? t('{count} days left', { count: left }) : t('Open')} />
        </Link>;
    }
    if (offer.kind === 'shop') {
        const { product } = offer, soldOut = Boolean(product.variants?.length && product.variants.every(variant => variant.stock <= 0));
        return <Link className="gk-offer" to={`/store/products/${product.id}`}>
            <Tile label={t('Club shop')} image={product.images?.[0]} title={product.name ?? ''} club={{ name: product.clubName ?? '', logo: product.clubLogoUrl }}
                fact={soldOut ? <span data-tone="muted">{t('Out of stock')}</span> : <b>{product.price} {product.currency}</b>} />
        </Link>;
    }
    const { sponsor, club } = offer;
    const tile = <Tile label={t('Sponsor of {club}', { club: club.name })} image={sponsor.logoUrl} contain title={sponsor.name} club={{ name: club.name, logo: club.logoUrl }}
        fact={sponsor.websiteUrl ? host(sponsor.websiteUrl) : t('See the club')} />;
    return sponsor.websiteUrl
        ? <a className="gk-offer" href={sponsor.websiteUrl} target="_blank" rel="sponsored noopener noreferrer">{tile}</a>
        : <Link className="gk-offer" to={`/clubs/${club.id}`}>{tile}</Link>;
}

/**
 * What clubs near you offer, in one labelled row: their shops, fundraisers and the sponsors they publish. Never
 * paid placement and never ranked by payment; restricted or blocked sponsors are not shown.
 */
export function FromClubsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useFromClubs(area);
    const clubOf = (offer: Offer) => offer.kind === 'fundraiser' ? { id: offer.campaign.clubId, name: offer.campaign.clubName, logo: offer.campaign.clubLogoUrl }
        : offer.kind === 'shop' ? { id: offer.product.clubId ?? 0, name: offer.product.clubName ?? '', logo: offer.product.clubLogoUrl } : { id: offer.club.id, name: offer.club.name, logo: offer.club.logoUrl };
    const clubs = [...new Map(data.items.map(offer => { const club = clubOf(offer); return [club.id, club] as const; })).values()].slice(0, 3);
    return (
        <WorldField id="fromClubs" side={side} thumb={clubs.length ? <Cluster>{clubs.map(club => <Crest key={club.id} src={club.logo} name={club.name} size={30} round />)}</Cluster> : undefined} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={t('Club shops, fundraisers and sponsors · none of it is paid placement')} all={{ label: t('All fundraisers'), to: '/campaigns' }}>
            {data.items.length ? <ul className="gk-offers" aria-label={t('From the clubs')}>{data.items.map(offer => <li key={offer.id}><OfferTile offer={offer} /></li>)}</ul>
                : <EmptyNote title={t('Nothing from clubs near {city} yet', { city: area.city })} />}
        </WorldField>
    );
}
