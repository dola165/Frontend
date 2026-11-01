import './travel.css';
import { ButtonLink } from '../../design/primitives';

import type { ExistingTravelLink } from './existingTravelLinks';
export function TravelExistingLinks({ links }: { links: ExistingTravelLink[] }) {
    return links.length ? <nav className="gk-travel-existing-links" aria-label="Existing travel">{links.map(l => <ButtonLink key={l.href} to={l.href}>{l.label}</ButtonLink>)}</nav> : null;
}
