import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacyCleanupRedirect } from './LegacyCleanupRedirects';

afterEach(cleanup);
function Where() { const location = useLocation(); return <output>{location.pathname}{location.search}{location.hash}</output>; }
it.each([
    ['/club-operations?appointmentId=7', 'connections', '/requests?appointmentId=7'],
    ['/club-operations?permissionId=8', 'connections', '/parent?permissionId=8&tab=connections'],
    ['/notifications?venueId=2&bookingId=9', 'notifications', '/requests?venueId=2&bookingId=9&view=updates'],
    ['/notifications?squadId=5&channel=coach&thread=3', 'notifications', '/requests?squadId=5&channel=coach&thread=3&view=updates'],
    ['/clubs/1/squads?squad=12#players', 'squads', '/clubs/1?squad=12&tab=teams#players'],
] as const)('preserves the old address context from %s', (from, kind, expected) => {
    render(<MemoryRouter initialEntries={[from]}><Routes><Route path={kind === 'squads' ? '/clubs/:id/squads' : from.split('?')[0]} element={<LegacyCleanupRedirect kind={kind} />} /><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    expect(screen.getByText(expected)).toBeInTheDocument();
});
