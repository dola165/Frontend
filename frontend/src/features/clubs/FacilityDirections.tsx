import { lazy, Suspense, type ComponentProps } from 'react';

// The directions panel brings the map library, so it loads when someone asks for directions, not with the club page.
const Panel = lazy(() => import('./FacilityDirectionsPanel').then(module => ({ default: module.FacilityDirectionsPanel })));

/** FacilityDirectionsPanel, loaded on first use. It opens as an overlay, so nothing on the page waits for it. */
export function FacilityDirections(props: ComponentProps<typeof Panel>) {
    return <Suspense fallback={null}><Panel {...props} /></Suspense>;
}
