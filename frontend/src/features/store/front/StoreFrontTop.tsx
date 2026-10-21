import { ct, useCommerceCopy } from '../copy';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ShoppingBag, Store } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ButtonLink, Count, SearchInput } from '../../../design/primitives';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import { isLeadershipRole } from '../../clubs/domain';
import { useWorldData } from '../../world/useWorldData';
import { cataloguePath } from '../query';
import { useCartCount } from '../useCartCount';
import { commerceCount } from '../count';
import { CATEGORIES, COLLECTIONS } from '../labels';
import { CircleStrip } from './MarketTabs';

/**
 * The storefront's first row: the title, one wide search, Browse all and the cart; for someone who runs a club's store,
 * a quiet Add a product that opens the club store's own add form.
 */
export function StoreHead() {
    useCommerceCopy();
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const count = useCartCount();
    const { status } = useAuth();
    const membership = useWorldData(status === 'authenticated' ? 'my-club' : null, () => fetchMyClubMembershipContext());
    const seller = membership.data?.clubId && isLeadershipRole(membership.data.myRole) ? membership.data : null;
    return (
        <div className="gk-store-head">
            <div><h1>{ct("Store")}</h1><p className="gk-store-head__hint">{ct("GrassKickZ equipment and every club store")}</p></div>
            <form className="gk-store-head__search" role="search" onSubmit={event => { event.preventDefault(); navigate(cataloguePath({ query: text.trim() })); }}>
                <SearchInput aria-label={ct("Search products or clubs")} placeholder={ct("Search products or clubs")} maxLength={100} value={text} onChange={event => setText(event.target.value)} />
            </form>
            <div className="gk-store-head__actions">
                {seller && <ButtonLink variant="ghost" to={`/clubs/${seller.clubId}/store?add=1`} aria-label={ct("Add a product to {v0}’s store", { v0: seller.clubName ?? ct("your club") })}><Plus aria-hidden="true" />{ct("Add a product")}</ButtonLink>}
                <ButtonLink to={cataloguePath()}>{ct("Browse all")}</ButtonLink>
                <ButtonLink className="gk-store-cart-btn" to="/store/cart" aria-label={count ? `${ct('Cart')}, ${commerceCount(count, 'item')}` : ct("Cart")}><ShoppingBag aria-hidden="true" />{ct("Cart")}<Count value={count} /></ButtonLink>
            </div>
        </div>
    );
}

/** Two big doors: GrassKickZ's own equipment and the clubs' stores, each with its shortcuts. */
export function StoreDoors({ own, sellers }: { own?: number; sellers?: number }) {
    useCommerceCopy();
    return (
        <div className="gk-store-doors">
            <article className="gk-store-door"><img className="gk-store-door__pic" src="/football/ball-field.jpg" alt="" />
                <span className="gk-store-door__eyebrow"><img src="/brand/grasskickz-mark.svg" alt="" />{ct("Sold by GrassKickZ")}</span>
                <Link className="gk-store-door__title" to={cataloguePath({ seller: 'grasskickz' })}>{ct("Shop GrassKickZ equipment")}</Link>
                <p className="gk-store-door__line">{ct("Balls, cones, bibs, shin guards and training gear")}{own ? ct(" · {v0} products", { v0: own }) : ''}</p>
                <div className="gk-store-door__chips">{COLLECTIONS.slice(0, 5).map(collection => <Link key={collection.id} className="gk-store-door__chip" to={cataloguePath({ seller: 'grasskickz', collection: collection.id })}>{ct(collection.label)}</Link>)}</div>
            </article>
            <article className="gk-store-door"><img className="gk-store-door__pic" src="/football/touchline.jpg" alt="" />
                <span className="gk-store-door__eyebrow"><Store aria-hidden="true" size={16} />{ct("Club stores")}</span>
                <Link className="gk-store-door__title" to={cataloguePath({ seller: "clubs" })}>{ct("Explore club stores")}</Link>
                <p className="gk-store-door__line">{ct("Kit, tickets and membership from ")}{sellers ? ct("{v0} clubs", { v0: sellers }) : "clubs"}{ct(" on GrassKickZ")}</p>
                <div className="gk-store-door__chips">
                    <a className="gk-store-door__chip" href="#store-near">{ct("Near you")}</a>
                    <a className="gk-store-door__chip" href="#store-followed">{ct("Clubs you follow")}</a>
                    <Link className="gk-store-door__chip" to={cataloguePath({ seller: "clubs", category: 'SHIRT' })}>{ct("Shirts")}</Link>
                    <Link className="gk-store-door__chip" to={cataloguePath({ seller: "clubs", category: 'TICKETS' })}>{ct("Tickets")}</Link>
                </div>
            </article>
        </div>
    );
}

/** Compact categories as a strip of circles, each opening the catalogue on that category. */
export function Categories() {
    useCommerceCopy();
    return (
        <CircleStrip title={ct("Shop by category")} hint={ct("Everything on sale, by kind")} label={ct("Shop by category")}>
            {CATEGORIES.filter(category => category.id !== 'OTHER').map(category => (
                <Link key={category.id} className="gk-store-cat" to={cataloguePath({ category: category.id })}>
                    <span className="gk-store-cat__icon"><category.icon aria-hidden="true" /></span>
                    <span>{ct(category.label)}</span>
                </Link>
            ))}
        </CircleStrip>
    );
}
