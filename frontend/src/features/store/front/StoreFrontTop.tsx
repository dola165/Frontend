import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ShoppingBag, Store } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ButtonLink, Count, SearchInput } from '../../../design/primitives';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import { canManageClubOperations } from '../../clubs/domain';
import { useWorldData } from '../../world/useWorldData';
import { cataloguePath } from '../query';
import { useCartCount } from '../useCartCount';
import { CATEGORIES, COLLECTIONS } from '../labels';
import { CircleStrip } from './MarketTabs';

/**
 * The storefront's first row: the title, one wide search, Browse all and the cart; for someone who runs a club's store,
 * a quiet Add a product that opens the club store's own add form.
 */
export function StoreHead() {
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const count = useCartCount();
    const { status } = useAuth();
    const membership = useWorldData(status === 'authenticated' ? 'my-club' : null, () => fetchMyClubMembershipContext());
    const seller = membership.data?.clubId && canManageClubOperations(membership.data.myRole) ? membership.data : null;
    return (
        <div className="gk-store-head">
            <div><h1>Store</h1><p className="gk-store-head__hint">GrassKickZ equipment and every club store</p></div>
            <form className="gk-store-head__search" role="search" onSubmit={event => { event.preventDefault(); navigate(cataloguePath({ query: text.trim() })); }}>
                <SearchInput aria-label="Search products or clubs" placeholder="Search products or clubs" maxLength={100} value={text} onChange={event => setText(event.target.value)} />
            </form>
            <div className="gk-store-head__actions">
                {seller && <ButtonLink variant="ghost" to={`/clubs/${seller.clubId}/store?add=1`} aria-label={`Add a product to ${seller.clubName ?? 'your club'}’s store`}><Plus aria-hidden="true" />Add a product</ButtonLink>}
                <ButtonLink to={cataloguePath()}>Browse all</ButtonLink>
                <ButtonLink className="gk-store-cart-btn" to="/store/cart" aria-label={count ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart'}><ShoppingBag aria-hidden="true" />Cart<Count value={count} /></ButtonLink>
            </div>
        </div>
    );
}

/** Two big doors: GrassKickZ's own equipment and the clubs' stores, each with its shortcuts. */
export function StoreDoors({ own, sellers }: { own?: number; sellers?: number }) {
    return (
        <div className="gk-store-doors">
            <article className="gk-store-door"><img className="gk-store-door__pic" src="/football/ball-field.jpg" alt="" />
                <span className="gk-store-door__eyebrow"><img src="/brand/grasskickz-mark.svg" alt="" />Sold by GrassKickZ</span>
                <Link className="gk-store-door__title" to={cataloguePath({ seller: 'grasskickz' })}>Shop GrassKickZ equipment</Link>
                <p className="gk-store-door__line">Balls, cones, bibs, shin guards and training gear{own ? ` · ${own} products` : ''}</p>
                <div className="gk-store-door__chips">{COLLECTIONS.slice(0, 5).map(collection => <Link key={collection.id} className="gk-store-door__chip" to={cataloguePath({ seller: 'grasskickz', collection: collection.id })}>{collection.label}</Link>)}</div>
            </article>
            <article className="gk-store-door"><img className="gk-store-door__pic" src="/football/touchline.jpg" alt="" />
                <span className="gk-store-door__eyebrow"><Store aria-hidden="true" size={16} />Club stores</span>
                <Link className="gk-store-door__title" to={cataloguePath({ seller: 'clubs' })}>Explore club stores</Link>
                <p className="gk-store-door__line">Kit, tickets and membership from {sellers ? `${sellers} clubs` : 'clubs'} on GrassKickZ</p>
                <div className="gk-store-door__chips">
                    <a className="gk-store-door__chip" href="#store-near">Near you</a>
                    <a className="gk-store-door__chip" href="#store-followed">Clubs you follow</a>
                    <Link className="gk-store-door__chip" to={cataloguePath({ seller: 'clubs', category: 'SHIRT' })}>Shirts</Link>
                    <Link className="gk-store-door__chip" to={cataloguePath({ seller: 'clubs', category: 'TICKETS' })}>Tickets</Link>
                </div>
            </article>
        </div>
    );
}

/** Compact categories as a strip of circles, each opening the catalogue on that category. */
export function Categories() {
    return (
        <CircleStrip title="Shop by category" hint="Everything on sale, by kind" label="Shop by category">
            {CATEGORIES.filter(category => category.id !== 'OTHER').map(category => (
                <Link key={category.id} className="gk-store-cat" to={cataloguePath({ category: category.id })}>
                    <span className="gk-store-cat__icon"><category.icon aria-hidden="true" /></span>
                    <span>{category.label}</span>
                </Link>
            ))}
        </CircleStrip>
    );
}
