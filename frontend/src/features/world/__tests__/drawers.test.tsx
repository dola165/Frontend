import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ResultRow } from '../directory/ResultRow';
import { parsePeek, usePeek } from '../peek/usePeek';

/** The address, so a test can read which drawers are open. */
function Address() {
    const location = useLocation();
    return <output data-testid="address">{location.search}</output>;
}
const address = () => screen.getByTestId('address').textContent;

/** A club opened beside the thing on the right, the way a drawer's club link does it. */
function SideOpener() {
    const drawers = usePeek();
    return <>
        <button type="button" onClick={() => drawers.openSide('club-7')}>Open club</button>
        <button type="button" onClick={() => drawers.open('job-3', { keepSide: true })}>Open its role</button>
        <button type="button" onClick={drawers.closeSide}>Close club</button>
    </>;
}

const show = (search = '') => render(
    <MemoryRouter initialEntries={[`/world/people${search}`]}>
        <ul>
            <ResultRow lead={null} title="Ilia Sulaberidze" to="/profile/39" peek="person-39" lines={['Head coach', 'Tbilisi · 6.7 km']}
                action={<button type="button">Follow</button>} />
        </ul>
        <SideOpener />
        <Address />
    </MemoryRouter>,
);

describe('World drawers', () => {
    it('reads a drawer from the address only when it is a kind World can show', () => {
        expect(parsePeek('person-12')).toEqual({ kind: 'person', id: '12' });
        expect(parsePeek('job-3')).toEqual({ kind: 'job', id: '3' });
        expect(parsePeek('match-t301.7010')).toEqual({ kind: 'match', id: 't301.7010' });
        expect(parsePeek('tournament-301')).toEqual({ kind: 'tournament', id: '301' });
        expect(parsePeek('venue-3')).toEqual({ kind: 'venue', id: '3' });
        expect(parsePeek('event-3')).toBeNull();
        expect(parsePeek('person')).toBeNull();
    });

    it('opens a result on the right from its name or anywhere on its row, but not from its own action', () => {
        show('?tab=staff');
        fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
        expect(address()).toBe('?tab=staff');
        fireEvent.click(screen.getByText('Head coach'));
        expect(address()).toBe('?tab=staff&peek=person-39');
    });

    it('lets a modified click on the name go to the full page instead', () => {
        show();
        const name = screen.getByRole('link', { name: 'Ilia Sulaberidze' });
        expect(name).toHaveAttribute('href', '/profile/39');
        fireEvent.click(name, { ctrlKey: true });
        expect(address()).toBe('');
    });

    it('opens who is behind a thing on the left, keeps it beside a role opened from it, and closes it alone', () => {
        show('?peek=job-1');
        fireEvent.click(screen.getByRole('button', { name: 'Open club' }));
        expect(address()).toBe('?peek=job-1&side=club-7');
        fireEvent.click(screen.getByRole('button', { name: 'Open its role' }));
        expect(address()).toBe('?peek=job-3&side=club-7');
        fireEvent.click(screen.getByRole('button', { name: 'Close club' }));
        expect(address()).toBe('?peek=job-3');
        // Another result opened on the right closes the left one: it belonged to the last thing.
        fireEvent.click(screen.getByRole('button', { name: 'Open club' }));
        fireEvent.click(screen.getByText('Head coach'));
        expect(address()).toBe('?peek=person-39');
    });
});
