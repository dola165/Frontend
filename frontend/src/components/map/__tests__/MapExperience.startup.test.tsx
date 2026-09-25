import { useEffect, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../i18n';
import { MapExperience } from '../MapExperience';
import { fetchMapDiscovery, type MapPageResult } from '../../../api/map';
import { fetchMyClubMembershipContext } from '../../../features/clubs/api';

const renderer = vi.hoisted(() => ({ mounted: vi.fn(), props: {} as Record<string, unknown> }));
vi.mock('../../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated' }) }));
vi.mock('../../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:3000/' } }));
vi.mock('../../../api/map', () => ({ fetchMapDiscovery: vi.fn(), fetchNearbyMap: vi.fn(), geocodePlace: vi.fn() }));
vi.mock('react-map-gl/maplibre', () => ({
    default: function TestMap(props: { children: ReactNode; initialViewState: unknown }) {
        renderer.props = props;
        useEffect(() => { renderer.mounted(); }, []);
        return <div data-testid="basemap" data-camera={JSON.stringify(props.initialViewState)}>{props.children}</div>;
    },
    useMap: () => ({ current: null }),
    Layer: () => null,
    Marker: ({ children }: { children: ReactNode }) => children,
    NavigationControl: () => null,
    Source: ({ id, data, children }: { id: string; data: { features: unknown[] }; children: ReactNode }) =>
        <div data-testid={id} data-count={data.features.length}>{children}</div>,
}));

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
};
const page: MapPageResult = { content: [{ entityId: 1, entityType: 'CLUB', title: 'Nearby club', subtitle: 'Club', clubName: 'Nearby club',
    latitude: 41.72, longitude: 44.8, distanceKm: 1, members: 10, followers: 3, verified: true, date: '', fee: '',
    addressText: '', ageGroup: '', status: '', cityName: 'Tbilisi', countryName: 'Georgia' }], page: 0, size: 100, totalElements: 1 };
beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchMapDiscovery).mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetchMyClubMembershipContext).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 8, sources: { streets: { type: 'vector' } },
        layers: [{ id: 'background', type: 'background', paint: {} }, { id: 'street-label', type: 'symbol', paint: { 'text-color': '#000' } }] }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('mounts the basemap at the saved camera while discovery and membership are still pending', () => {
    const savedCamera = { latitude: 41.72, longitude: 44.8, zoom: 14 };
    localStorage.setItem('android.map.v1.camera', JSON.stringify(savedCamera));
    render(<MemoryRouter><MapExperience darkMode={false} /></MemoryRouter>);
    expect(screen.getByTestId('basemap')).toHaveAttribute('data-camera', JSON.stringify({ ...savedCamera, pitch: 0, bearing: 0 }));
    expect(screen.getByText('Loading nearby results…').closest('[role="status"]')?.parentElement).toHaveClass('pointer-events-none');
    expect(fetchMapDiscovery).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchMapDiscovery).mock.calls.map(call => call[0].type)).toEqual([['CLUB'], ['STADIUM']]);
    expect(fetchMyClubMembershipContext).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle nearby results' }));
    expect(screen.getByRole('complementary', { name: 'Nearby results' })).toBeInTheDocument();
    expect(renderer.mounted).toHaveBeenCalledOnce();
});

it('adds completed results without remounting the map or starting a second camera animation', async () => {
    const discovery = deferred<MapPageResult>();
    vi.mocked(fetchMapDiscovery).mockImplementation(params => params.type?.[0] === 'STADIUM' ? Promise.resolve({ ...page, content: [], totalElements: 0 }) : discovery.promise);
    vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: false, canCreateClub: false });
    render(<MemoryRouter><MapExperience darkMode={false} /></MemoryRouter>);
    const map = screen.getByTestId('basemap');
    const target = { getContainer: () => document.createElement('div'), setProjection: vi.fn(), easeTo: vi.fn() };
    act(() => (renderer.props.onLoad as (event: { target: typeof target }) => void)({ target }));
    expect(target.easeTo).not.toHaveBeenCalled();
    await act(async () => discovery.resolve(page));
    expect(screen.getByTestId('basemap')).toBe(map);
    expect(screen.getByTestId('map-points')).toHaveAttribute('data-count', '1');
    expect(screen.queryByText('Loading nearby results…')).not.toBeInTheDocument();
    await waitFor(() => expect(renderer.props.mapStyle).toHaveProperty('sources.streets'));
    expect(renderer.props.mapStyle).not.toHaveProperty('sources.atlas-elevation');
    expect(renderer.mounted).toHaveBeenCalledOnce();
});

it('keeps the basemap mounted and retry available when discovery fails', async () => {
    const discovery = deferred<MapPageResult>();
    vi.mocked(fetchMapDiscovery).mockImplementation(params => params.type?.[0] === 'STADIUM' ? Promise.resolve({ ...page, content: [], totalElements: 0 }) : discovery.promise);
    vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: false, canCreateClub: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MemoryRouter><MapExperience darkMode={false} /></MemoryRouter>);
    const map = screen.getByTestId('basemap');
    await act(async () => discovery.reject(new Error('Offline')));
    expect(screen.getByRole('alert').parentElement).toHaveClass('pointer-events-none');
    expect(screen.getByRole('alert').parentElement).not.toHaveClass('inset-0');
    vi.mocked(fetchMapDiscovery).mockResolvedValue(page);
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByTestId('basemap')).toBe(map);
    expect(renderer.mounted).toHaveBeenCalledOnce();
});

it('keeps compact discovery clear until the visitor moves the map, with search and results still accessible', async () => {
    vi.mocked(fetchMapDiscovery).mockResolvedValue(page);
    render(<MemoryRouter><MapExperience darkMode={false} context="guest" allowedEntityTypes={['CLUB']} mapTheme="light" filterLayout="external" embedded compactControls /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('Loading nearby results…')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Search clubs or cities on the map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Search visible map/ })).not.toBeInTheDocument();
    expect(renderer.props.scrollZoom).toBe(false);

    act(() => (renderer.props.onMoveEnd as (event: unknown) => void)({
        originalEvent: new Event('pointerup'), viewState: { latitude:41.73, longitude:44.81, zoom:13 },
    }));
    expect(screen.getByRole('button', { name: /Search this area/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name:'Toggle nearby results' }));
    expect(screen.getByRole('complementary', { name:'Nearby results' })).toBeInTheDocument();
    expect(renderer.mounted).toHaveBeenCalledOnce();
});
