import { ct, useCommerceCopy } from '../copy';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, HeartHandshake, ShoppingBag } from 'lucide-react';
import { Section } from '../../../design/primitives';

const PLACES = [
    { id: 'store', label: 'Store', to: '/store', icon: ShoppingBag },
    { id: 'jobs', label: 'Jobs & volunteering', short: 'Jobs', to: '/jobs', icon: Briefcase },
    { id: 'fundraising', label: 'Fundraising', to: '/campaigns', icon: HeartHandshake },
] as const;
export type MarketPlace = typeof PLACES[number]['id'];

/** The three places with the same DNA, one press apart: Store, Fundraising, Jobs & volunteering. The move is a view transition: the page crossfades and the lit tab glides. */
export function MarketTabs({ current }: { current: MarketPlace }) {
    useCommerceCopy();
    return (
        <nav className="gk-market-tabs gk-segmented" aria-label={ct("Store, fundraising and jobs")}>
            {PLACES.map(place => <Link key={place.id} viewTransition className="gk-segmented__item" data-market={place.id} to={place.to} aria-current={place.id === current ? "page" : undefined}><place.icon aria-hidden="true" />{'short' in place ? <><span className="gk-market-tabs__long">{ct(place.label)}</span><span className="gk-market-tabs__short" aria-hidden="true">{ct(place.short)}</span></> : ct(place.label)}</Link>)}
        </nav>
    );
}

/** The strip of circles under its name, so the row says what it is. `dense` fits more circles on one line. */
export function CircleStrip({ title, hint, label, dense, children }: { title: string; hint?: string; label: string; dense?: boolean; children: ReactNode }) {
    useCommerceCopy();
    return (
        <Section title={title} hint={hint} className="gk-store-cats-section">
            <nav className="gk-store-cats" aria-label={label} data-dense={dense || undefined}>{children}</nav>
        </Section>
    );
}
