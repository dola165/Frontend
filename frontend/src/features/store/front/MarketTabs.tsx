import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../../components/layout/BrandMark';
import './market-branding.css';
import { Section } from '../../../design/primitives';

const PLACES = [
    { id: 'store', label: 'Store', to: '/store', mark: 'store' },
    { id: 'jobs', label: 'Jobs & volunteering', to: '/jobs', mark: 'jobs' },
    { id: 'fundraising', label: 'Fundraising', to: '/campaigns', mark: 'campaigns' },
] as const;
export type MarketPlace = typeof PLACES[number]['id'];

/** The three places with the same DNA, one press apart: Store, Fundraising, Jobs & volunteering. The move is a view transition: the page crossfades and the lit tab glides. */
export function MarketTabs({ current }: { current: MarketPlace }) {
    return (
        <nav className="gk-market-tabs gk-segmented" aria-label="Store, fundraising and jobs">
            {PLACES.map(place => <Link key={place.id} viewTransition className="gk-segmented__item" data-market={place.id} to={place.to} aria-current={place.id === current ? 'page' : undefined}><span className="gk-market-mark"><BrandMark variant={place.mark} /></span>{place.label}</Link>)}
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
