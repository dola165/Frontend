import { useEffect, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../i18n';
import { MapExperience } from '../MapExperience';
import { fetchMapDiscovery, type MapPageResult } from '../../../api/map';
import { fetchMyClubMembershipContext } from '../../../features/clubs/api';
import { fetchVenue, type Venue } from '../../../features/venues/api';
import { fetchAdmissionHome, fetchOpportunity, searchOpportunities } from '../../../features/admissions/api';
import opportunityJson from '../../../features/admissions/applicant/__fixtures__/opportunities.json?raw';
import type { AdmissionHome, OpportunityPage } from '../../../features/admissions/types';

const renderer = vi.hoisted(() => ({ mounted: vi.fn(), props: {} as Record<string, unknown> }));
const auth = vi.hoisted(() => ({status:'authenticated',isAuthenticated:false,user:undefined as {id:number}|undefined,sessionId:null as string|null}));
vi.mock('../../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../features/clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn().mockResolvedValue({data:{}}) }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:3000/' } }));
vi.mock('../../../api/map', () => ({ fetchMapDiscovery: vi.fn(), fetchNearbyMap: vi.fn(), geocodePlace: vi.fn() }));
vi.mock('../../../features/admissions/api', () => ({ searchOpportunities: vi.fn().mockResolvedValue({items:[],hasMore:false}), fetchOpportunity: vi.fn(), fetchAdmissionHome: vi.fn().mockResolvedValue({participants:[],cases:[]}) }));
vi.mock('../../../features/venues/api', async () => ({ ...await vi.importActual('../../../features/venues/api'), fetchVenue: vi.fn() }));
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
    Source: ({ id, data, children }: { id: string; data: { features?: unknown[] }; children: ReactNode }) =>
        <div data-testid={id} data-count={data.features?.length ?? 1}>{children}</div>,
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
    auth.isAuthenticated=false;auth.user=undefined;auth.sessionId=null;
    vi.clearAllMocks();
    vi.mocked(fetchVenue).mockReset();
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

it('keeps the authorized child on a linked actual-venue card while the mobile filters are closed',async()=>{
    auth.isAuthenticated=true;auth.user={id:77};auth.sessionId='map-review';localStorage.setItem('gk-session-id',auth.sessionId);
    const o=(JSON.parse(opportunityJson) as OpportunityPage).items[0];
    o.location.latitude=41.727;o.location.longitude=44.775;
    vi.mocked(fetchOpportunity).mockResolvedValue(o);
    vi.mocked(fetchAdmissionHome).mockResolvedValue({participants:[{id:88,name:'Synthetic child',dateOfBirth:'2014-05-01',gender:'MALE',minor:true,guardian:true,provenance:null,restriction:null}],cases:[]} as AdmissionHome);
    vi.mocked(fetchMapDiscovery).mockResolvedValue({...page,content:[]});
    vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({hasClubMembership:false,canCreateClub:false});
    render(<MemoryRouter initialEntries={[`/world?opportunity=${o.id}&player=88`]}><MapExperience darkMode={false}/></MemoryRouter>);
    await waitFor(()=>expect(screen.getByRole('link',{name:'View joining arrangements'})).toHaveAttribute('href',`/admissions/opportunities/${o.id}?player=88`));
    expect(vi.mocked(searchOpportunities).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({birthYear:2014,gender:'MALE'}));
});

it('opens a linked venue while general discovery is pending and retains it when discovery omits it', async () => {
    const discovery = deferred<MapPageResult>();
    vi.mocked(fetchMapDiscovery).mockReturnValue(discovery.promise);
    vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: false, canCreateClub: false });
    vi.mocked(fetchVenue).mockResolvedValue({ id: 123, displayName: 'Linked Isani venue', addressText: 'Isani', city: 'Tbilisi',
        latitude: 41.72, longitude: 44.8, published: true, pitches: [], verificationStatus: 'UNVERIFIED', currency: 'GEL' } as unknown as Venue);
    render(<MemoryRouter initialEntries={['/map?venue=123']}><MapExperience darkMode={false} /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /^Linked Isani venue/ })).toBeVisible();
    await act(async () => discovery.resolve({ ...page, content: [], totalElements: 0 }));
    expect(screen.getByRole('heading', { name: /^Linked Isani venue/ })).toBeVisible();
    expect(screen.getByTestId('basemap')).toBeInTheDocument();
    expect(screen.getByTestId('map-points')).toHaveAttribute('data-count', '0'); // selected pin has its own layer
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

it('lets public full-map visitors narrow accepting groups even after the basemap fails', async () => {
    vi.mocked(fetchMapDiscovery).mockResolvedValue(page);
    render(<MemoryRouter><MapExperience darkMode={false} context="guest" /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('Loading nearby results…')).not.toBeInTheDocument());
    act(() => (renderer.props.onError as (event: unknown) => void)({target:{getStyle:()=>({layers:[]})}}));
    expect(screen.getByText('The map could not load. You can still browse the results list.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle filters' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Accepting players' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }));
    await waitFor(() => expect(vi.mocked(searchOpportunities).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({acceptingOnly:true})));
});
