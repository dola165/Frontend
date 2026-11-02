import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { clubSearchParams } from '../directories/clubSources';
import { groupSearch, trialSearch } from '../directories/opportunitySearch';
import { cardParams } from '../directories/tournaments/allSource';
import { loadListings } from '../directories/matches/listings';
import { windowFilters } from '../directories/matches/matchday';
import { applyWorldFor } from '../searchContext';
import { CARRIED } from '../directory/useDirectoryState';
import { WatchSearch } from '../watches/WatchSearch';
import { WatchReturn } from '../watches/WatchReturn';
import * as watches from '../watches/api';
import type { DirectoryQuery } from '../directory/types';

const state = vi.hoisted(() => ({ session: 'one', status: 'authenticated' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: state.status, sessionId: state.session, user: { id: 4, dob: '1988-01-01' } }) }));
vi.mock('../useWorldArea', () => ({ useWorldArea: () => ({ area: { city: 'Batumi', centre: {lat:41.6,lng:41.6}, ready:true, anywhere:false, country:null } }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('../watches/api', async original => ({ ...await original<typeof watches>(), listSearchWatches: vi.fn(), keepSearch: vi.fn(), stopSearch: vi.fn(), readSearchWatch: vi.fn() }));
const query = (values: Record<string,string> = {}): DirectoryQuery => ({ q:'',sort:'',values:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,[v]])) });
const child = { id:9,name:'Private Child',dateOfBirth:'2018-12-30',minor:true,guardian:true,gender:'FEMALE' as const,provenance:null };
const area = {city:'Batumi',centre:{lat:41.6,lng:41.6}};
const context = {area,country:null,authenticated:true,sessionId:'one',signal:new AbortController().signal};
const spec = watches.searchSpec('CLUBS',new URLSearchParams('city=Batumi&birthYear=2018'));

beforeEach(() => { vi.clearAllMocks(); state.session='one';state.status='authenticated'; vi.mocked(watches.listSearchWatches).mockResolvedValue([]); });

it('sends anonymous cohort and the shared city to clubs, groups and trials with explicit filters winning', () => {
    const effective = applyWorldFor(query(), '2018');
    const club = clubSearchParams(effective,{child,area});
    expect(club.get('birthYear')).toBe('2018');expect(club.get('city')).toBe('Batumi');
    expect(club.toString()).not.toMatch(/Private|2018-12|player|child|guardian/);
    expect(groupSearch(effective,child,context)).toMatchObject({birthYear:2018,city:['Batumi'],gender:'FEMALE'});
    expect(trialSearch(effective,context)).toMatchObject({birthYear:'2018',location:'Batumi',forMe:undefined});
    expect(clubSearchParams(applyWorldFor(query({ageGroup:'U16',city:'Rustavi'}),'2018'),{area}).toString()).toContain('city=Rustavi');
    expect(applyWorldFor(query({ageGroup:'U16'}),'2018').values.birthYear).toBeUndefined();
    expect(trialSearch(query({location:'Rustavi'}),context).location).toBe('Rustavi');
});
it('tournaments use the shared area and birth year but a named host or city overrides it', () => {
    const effective = cardParams(applyWorldFor(query(),'2018'),area);
    expect(effective.get('birthYear')).toBe('2018');expect(effective.get('latitude')).toBe('41.6');
    const choices: Record<string,string>[] = [{host:'CLUB:12'},{city:'Rustavi'},{country:'DE'}];
    for (const chosen of choices) expect(cardParams(query(chosen),area).has('latitude')).toBe(false);
});
it('fixtures and open matches send context in the server query before pagination', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({data:{items:[],total:0}});
    await loadListings(false,applyWorldFor(query(),'2018'),2,context.signal,null,area);
    const url=String(vi.mocked(apiClient.get).mock.calls.at(-1)?.[0]);
    expect(url).toContain('birthYear=2018');expect(url).toContain('lat=41.6');expect(url).toContain('page=2');
    expect(windowFilters(applyWorldFor(query({city:'Batumi'}),'2018'))).toContain('birthYear=2018');
    expect(CARRIED).toEqual(expect.arrayContaining(['near','player','for','birthYear']));
});
it('follows a child’s club search by itself, retaining a private return path and saying so honestly when it fails', async () => {
    vi.mocked(watches.keepSearch).mockRejectedValue(new Error('Try later'));
    render(<MemoryRouter initialEntries={['/parent?find=club&player=9&selected=2']}><WatchSearch spec={spec} childId={9}/></MemoryRouter>);
    expect(await screen.findByText('New places for your child could not be followed.')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Follow this search|Stop/})).not.toBeInTheDocument();
    expect(watches.keepSearch).toHaveBeenCalledTimes(1);
    expect(watches.keepSearch).toHaveBeenCalledWith(spec,expect.stringContaining('/parent?'),9,'one',expect.any(AbortSignal));
    const saved = new URL(vi.mocked(watches.keepSearch).mock.calls[0][1], 'https://test.invalid').searchParams;
    expect(saved.get('find')).toBe('club'); expect(saved.get('player')).toBe('9'); expect(saved.get('near')).toBe('Batumi');
    expect(saved.get('birthYear')).toBe('2018'); expect(saved.get('city')).toBe('Batumi'); expect(saved.get('selected')).toBe('2');
});
it('shows one quiet line with Stop once a child’s search is followed, and Stop is not undone by the page', async () => {
    const followed = {id:7,query:spec,returnPath:'/parent?find=club&player=9&near=Batumi',childId:9,active:true};
    vi.mocked(watches.listSearchWatches).mockResolvedValueOnce([]).mockResolvedValueOnce([followed]).mockResolvedValue([]);
    vi.mocked(watches.keepSearch).mockResolvedValue(followed);
    vi.mocked(watches.stopSearch).mockResolvedValue({} as never);
    render(<MemoryRouter initialEntries={['/parent?find=club&player=9']}><WatchSearch spec={spec} childId={9}/></MemoryRouter>);
    expect(await screen.findByText('We’ll tell you about new places for your child')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Stop'}));
    expect(watches.stopSearch).toHaveBeenCalledWith(7,'one',expect.any(AbortSignal));
    await waitFor(()=>expect(screen.queryByText(/new places for/)).not.toBeInTheDocument());
    expect(watches.keepSearch).toHaveBeenCalledTimes(1);
});
it('follows once and shows the line under React strict mode, whose effects run twice', async () => {
    const followed = {id:7,query:spec,returnPath:'/world/clubs?player=9&near=Batumi',childId:9,active:true};
    let kept = false;
    vi.mocked(watches.listSearchWatches).mockImplementation(async () => kept ? [followed] : []);
    vi.mocked(watches.keepSearch).mockImplementation(async () => { kept = true; return followed; });
    render(<StrictMode><MemoryRouter initialEntries={['/world/clubs?player=9']}><WatchSearch spec={spec} childId={9}/></MemoryRouter></StrictMode>);
    expect(await screen.findByText('We’ll tell you about new places for your child')).toBeInTheDocument();
    expect(watches.keepSearch).toHaveBeenCalledTimes(1);
});
it('does not follow again a search that was already followed when the page opened and then stopped', async () => {
    const followed = {id:7,query:spec,returnPath:'/world/clubs?player=9&near=Batumi',childId:9,active:true};
    vi.mocked(watches.listSearchWatches).mockResolvedValueOnce([followed]).mockResolvedValue([{...followed,active:false}]);
    vi.mocked(watches.stopSearch).mockResolvedValue({} as never);
    render(<MemoryRouter initialEntries={['/world/clubs?player=9']}><WatchSearch spec={spec} childId={9}/></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button',{name:'Stop'}));
    await waitFor(()=>expect(screen.queryByText(/new places for/)).not.toBeInTheDocument());
    expect(watches.keepSearch).not.toHaveBeenCalled();
});
it('shows nothing for a child who already has a club (the server refuses to follow)', async () => {
    vi.mocked(watches.keepSearch).mockRejectedValue({response:{status:403}});
    render(<MemoryRouter initialEntries={['/world/clubs?player=9']}><WatchSearch spec={spec} childId={9}/></MemoryRouter>);
    await waitFor(()=>expect(watches.keepSearch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/new places for|could not be followed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('cannot display the prior login’s watches while a different session loads', async () => {
    vi.mocked(watches.listSearchWatches).mockResolvedValueOnce([{id:7,query:spec,returnPath:'/world/clubs?near=Batumi',childId:null,active:true}]);
    const view=render(<MemoryRouter><WatchSearch spec={spec}/></MemoryRouter>);
    await screen.findByRole('button',{name:'Stop following this search'});
    state.session='two';vi.mocked(watches.listSearchWatches).mockReturnValue(new Promise(()=>{}));
    view.rerender(<MemoryRouter><WatchSearch spec={spec}/></MemoryRouter>);
    expect(screen.queryByRole('button',{name:'Stop following this search'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:/Open saved search/})).not.toBeInTheDocument();
});
function Path(){return <output data-testid="path">{useLocation().pathname}{useLocation().search}</output>;}
it('resolves an opaque notice for the current login to the exact family search', async () => {
    vi.mocked(watches.readSearchWatch).mockResolvedValue({id:7,query:spec,returnPath:'/parent?find=club&player=9&near=Batumi',childId:9,active:true});
    render(<MemoryRouter initialEntries={['/world/clubs?watch=7']}><WatchReturn/><Path/></MemoryRouter>);
    await waitFor(()=>expect(screen.getByTestId('path')).toHaveTextContent('/parent?defaults=none&find=club&player=9&near=Batumi'));
    expect(screen.getByTestId('path')).toHaveTextContent('birthYear=2018');
    expect(watches.readSearchWatch).toHaveBeenCalledWith('7','one',expect.any(AbortSignal));
});
