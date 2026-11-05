import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useMapFold } from '../directory/mapFold';

vi.mock('../useMediaQuery', () => ({ useMediaQuery: () => false }));
afterEach(() => { cleanup(); localStorage.clear(); });

function MapFold() {
    const { open, toggle } = useMapFold();
    const location = useLocation();
    return <><button onClick={toggle}>{open ? 'Close map' : 'Open map'}</button><output>{location.search}</output></>;
}

it('keeps the Following view and filters when opening and closing the map', () => {
    render(<MemoryRouter initialEntries={['/world/clubs?view=following&map=closed&q=Dinamo']}><MapFold /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open map' }));
    expect(screen.getByRole('status')).toHaveTextContent('?view=following&map=open&q=Dinamo');
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(screen.getByRole('status')).toHaveTextContent('?view=following&map=closed&q=Dinamo');
});

it.each(['split', 'map', 'list'])('removes only the old %s presentation value when toggling', view => {
    render(<MemoryRouter initialEntries={[`/world/clubs?view=${view}&q=Dinamo`]}><MapFold /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('status')).not.toHaveTextContent('view=');
    expect(screen.getByRole('status')).toHaveTextContent('q=Dinamo');
});
