import { useId, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MediaImage } from '../../../components/ui/MediaImage';
import { Button, EmptyNote, Section } from '../../../design/primitives';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { Crest } from '../../world/Crest';
import { useWorldCities } from '../../world/useWorldArea';
import type { StoreFront, StoreSeller } from '../api';
import { cataloguePath, clubStorePath } from '../query';
import { COLLECTIONS } from '../labels';
import { Row } from './Row';

/** GrassKickZ's own equipment as a row of tall pictures, each opening that collection. */
export function Collections({ front, float, tone }: { front: StoreFront | undefined; float?: 'left' | 'right'; tone?: 'a' | 'b' }) {
    const items = COLLECTIONS.map(collection => ({ ...collection, data: front?.collections.find(item => item.id === collection.id) })).filter(collection => !front || collection.data);
    return (
        <Section title="GrassKickZ equipment" hint="Sold by GrassKickZ" action={{ label: 'View all', to: cataloguePath({ seller: 'grasskickz' }) }} className={float ? `gk-band gk-band--${tone ?? 'a'}` : undefined}>
            <Row label="GrassKickZ equipment" drift={float}>
                {items.map(collection => (
                    <li key={collection.id}>
                        <Link className="gk-store-coll" to={cataloguePath({ seller: 'grasskickz', collection: collection.id })}>
                            <span className="gk-store-coll__pic">{collection.data?.image ? <MediaImage src={resolveMediaUrl(collection.data.image)} alt="" loading="lazy" /> : <span className="gk-skeleton" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden="true" />}</span>
                            <span className="gk-store-coll__title">{collection.label}</span>
                            <span className="gk-store-coll__line">{collection.data ? `${collection.data.products} ${collection.data.products === 1 ? 'product' : 'products'} · ${collection.line}` : collection.line}</span>
                        </Link>
                    </li>
                ))}
            </Row>
        </Section>
    );
}

const distance = (km: number) => km < 1 ? 'under 1 km' : `${Math.round(km)} km`;

/** Where the storefront is centred, with a way to change it. */
export function AreaPicker({ city, onChange }: { city: string; onChange: (city: string) => void }) {
    const id = useId();
    const cities = useWorldCities();
    const options = cities.includes(city) ? cities : [city, ...cities];
    return (
        <label className="gk-store-where" htmlFor={id}>
            <span>Based on</span>
            <select id={id} className="gk-input" value={city} onChange={event => onChange(event.target.value)} aria-label="City the store is centred on">
                {options.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </label>
    );
}

/** Clubs as tiles with the crest large: the storefront's shortcuts into each club's store. */
export function Sellers({ id, title, hint, sellers, loading, error, retry, empty, action, float, tone }: {
    id: string; title: string; hint?: ReactNode; sellers: StoreSeller[]; loading: boolean; error: string; retry: () => void; empty: string; action?: ComponentProps<typeof Section>['action'];
    float?: 'left' | 'right'; tone?: 'a' | 'b';
}) {
    return (
        <Section id={id} title={title} hint={hint} action={action} className={float ? `gk-band gk-band--${tone ?? 'a'}` : undefined}>
            {error ? <EmptyNote title="Clubs could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>
                : loading ? <ul className="gk-store-row" aria-busy="true" aria-label="Loading clubs">{[0, 1, 2, 3, 4, 5].map(i => <li key={i}><span className="gk-skeleton gk-store-skeleton" style={{ display: 'block' }} aria-hidden="true" /></li>)}</ul>
                : !sellers.length ? <EmptyNote title={empty} />
                : <Row label={title} drift={float}>
                    {sellers.map(seller => (
                        <li key={seller.clubId}>
                            <Link className="gk-store-seller" to={clubStorePath(seller.clubId)}>
                                <span className="gk-store-seller__pic"><Crest src={seller.logoUrl} name={seller.name} size={112} /></span>
                                <span className="gk-store-seller__name">{seller.name}</span>
                                <span className="gk-store-seller__line">{[seller.city, seller.distanceKm != null ? distance(seller.distanceKm) : null, `${seller.products} ${seller.products === 1 ? 'product' : 'products'}`].filter(Boolean).join(' · ')}</span>
                            </Link>
                        </li>
                    ))}
                </Row>}
        </Section>
    );
}
