import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, HeartHandshake, ShoppingBag } from 'lucide-react';
import { Section } from '../../../design/primitives';

const PLACES = [
    { id: 'store', label: 'Store', to: '/store', icon: ShoppingBag },
    { id: 'fundraising', label: 'Fundraising', to: '/campaigns', icon: HeartHandshake },
    { id: 'jobs', label: 'Jobs & volunteering', to: '/jobs', icon: Briefcase },
] as const;
export type MarketPlace = typeof PLACES[number]['id'];

/** The three places with the same DNA, one press apart: Store, Fundraising, Jobs & volunteering. */
export function MarketTabs({ current }: { current: MarketPlace }) {
    return (
        <nav className="gk-market-tabs gk-segmented" aria-label="Store, fundraising and jobs">
            {PLACES.map(place => <Link key={place.id} className="gk-segmented__item" to={place.to} aria-current={place.id === current ? 'page' : undefined}><place.icon aria-hidden="true" />{place.label}</Link>)}
        </nav>
    );
}

/** The strip of circles under its name, so the row says what it is. `dense` fits more circles on one line. */
export function CircleStrip({ title, hint, label, dense, children }: { title: string; hint?: string; label: string; dense?: boolean; children: ReactNode }) {
    return (
        <Section title={title} hint={hint} className="gk-store-cats-section">
            <nav className="gk-store-cats" aria-label={label} data-dense={dense || undefined}>{children}</nav>
        </Section>
    );
}
