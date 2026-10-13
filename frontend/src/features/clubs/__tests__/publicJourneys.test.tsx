import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { TabTraining } from '../../../components/club/tabs/TabTraining';
import { ClubFacilitiesTab } from '../profile/ClubFacilitiesTab';
import { ClubPeopleTab } from '../profile/ClubPeopleTab';
import type { ClubProfile } from '../profile/types';
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn() } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 }, sessionId: 's', status: 'authenticated' }) }));
vi.mock('../../../components/club/tabs/TabTeams', () => ({ TabTeams: () => <p>Club squads</p> }));
vi.mock('../SquadTrainingSchedule',()=>({SquadTrainingSchedule:()=> <div>Squad timetable</div>}));
vi.mock('../FacilityDirectionsPanel',()=>({FacilityDirectionsPanel:({title}:{title:string})=><div role="dialog">{title}</div>}));
const club = { id: 1, name: 'Demo academy', playerJoinPolicy: 'APPLICATION_REQUIRED', presentation: { profileKind: 'ACADEMY', programmes: [{ id: 22, name: 'U12 training', ageMin: 8, ageMax: 12, sessionsPerWeek: 2, priceType: 'FIXED', amount: '150', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0', joiningFee: '0', equipmentFee: null, details: 'Train together.', published: true, squadIds: [9] }], affiliations: [], sponsors: [] } } as unknown as ClubProfile;
const route = (element: React.ReactNode, url = '/clubs/1?tab=teams') => <MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 9, name: 'U12 mixed', category: 'U12' }] }); });
describe('public club journeys', () => {
  it('returns from the centred detail with the age and search filters and keyboard focus intact', async () => {
    vi.spyOn(window,'scrollTo').mockImplementation(() => undefined);
    render(route(<TabTraining club={club} onContact={vi.fn()} />, '/clubs/1?tab=teams&age=10&q=U12'));
    const card = await screen.findByRole('link', {name:/U12 training.*Programme details/});
    fireEvent.click(card);
    expect(screen.getByRole('heading',{name:'About the training'})).toBeVisible();
    fireEvent.click(screen.getByRole('link',{name:'All training & teams'}));
    expect(screen.getByRole('textbox',{name:'Find a squad or programme'})).toHaveValue('U12');
    expect(screen.getByRole('combobox',{name:/Player.s age/})).toHaveValue('10');
    expect(screen.getByRole('link', {name:/U12 training.*Programme details/})).toHaveFocus();
  });
  it('opens a specific programme and its assigned squad without returning to the feed', async () => {
    const contact = vi.fn();
    render(route(<TabTraining club={club} onContact={contact} />, '/clubs/1?tab=teams&programme=22'));
    expect(screen.getByRole('heading', { name: 'U12 training' })).toBeVisible();
    expect(await screen.findByRole('link', { name: /U12 mixed/ })).toHaveAttribute('href', '/clubs/1?tab=teams&squad=9');
    fireEvent.click(screen.getByRole('button', { name: /Ask a question/ }));
    expect(contact).toHaveBeenCalledWith({ name: 'U12 training', path: '/clubs/1?tab=teams&programme=22', squadIds: [9], intent:'question' });
  });
  it('does not turn missing or unpublished programmes into a different offer', () => {
    render(route(<TabTraining club={club} onContact={vi.fn()} />, '/clubs/1?tab=teams&programme=999'));
    expect(screen.getByRole('heading', { name: 'Programme unavailable' })).toBeVisible();
    expect(screen.queryByText('150 GEL / month')).not.toBeInTheDocument();
  });
  it('makes a sparse facility useful without inventing amenities', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: url.includes('/facilities') ? [{ id: 1, title: 'School pitch', details: { address: 'School street 79', relationship: 'SHARED' } }] : [] }));
    render(route(<ClubFacilitiesTab club={club} canEdit={false} />));
    fireEvent.click(await screen.findByRole('button', { name: /School pitch/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('School pitch');

    expect(screen.queryByText('Accessible toilets')).not.toBeInTheDocument();
  });
  it('keeps several appointments and does not turn account ownership into president', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ userId: 1, fullName: 'Demo coach', role: 'OWNER', responsibilities: [{ title: 'Goalkeeper coach', specialisations: ['GOALKEEPER_COACH'], squadId: 9, squadName: 'U12', startsOn: '2026-01-01', endsOn: null }, { title: 'U16 goalkeeper support', specialisations: ['GOALKEEPER_COACH'], squadId: 1, squadName: 'U16', startsOn: '2026-01-01', endsOn: null }] }] });
    render(route(<ClubPeopleTab clubId={1} canManageStaff={false} />));
    await screen.findByText('Demo coach');
    expect(screen.queryByText('President')).not.toBeInTheDocument();
    expect(screen.getByText('Goalkeeper coach · U16 goalkeeper support · U12 · U16')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Coaching' })).toBeVisible();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'nutritionist' } });
    await waitFor(() => expect(screen.getByText('No matching staff')).toBeVisible());
  });
  it('offers a public team summary without requiring player-record access', async () => {
    render(route(<TabTraining club={club} onContact={vi.fn()} />, '/clubs/1?tab=teams&squad=9'));
    expect(await screen.findByRole('heading', { name: 'U12 mixed' })).toBeVisible();
    expect(screen.getByRole('link', { name: /People helping U12 mixed/ })).toHaveAttribute('href', '/clubs/1?tab=people&squad=9');
    expect(screen.getByRole('link', { name: /Find the training ground/ })).toHaveAttribute('href', '/clubs/1?tab=facilities&squad=9');
    expect(screen.getByRole('link', { name: /Sign in to view player profiles/ })).toBeVisible();
  });
  it('filters published age ranges and restores a useful empty state', async () => {
    render(route(<TabTraining club={club} onContact={vi.fn()} />, '/clubs/1?tab=teams&age=17'));
    expect(screen.getByRole('heading', { name: 'No matching programmes' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('heading', { name: 'U12 training' })).toBeVisible();
  });
  it('does not show another squad’s facility as a location for this group', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: url.includes('/facilities') ? [{ id: 1, title: 'Shared ground', squadId: null, details: { address: 'One' } }, { id: 2, title: 'Girls training', squadId: 3, squadName: 'U16 Girls', details: { address: 'Two' } }] : [{ id: 9, name: 'U12 mixed', category: 'U12' }, { id: 3, name: 'U16 Girls', category: 'U16' }] }));
    render(route(<ClubFacilitiesTab club={club} canEdit={false} />, '/clubs/1?tab=facilities&squad=9'));
    expect(await screen.findByRole('button', { name: /Shared ground/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Girls training/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(await screen.findByRole('button', { name: /Girls training/ })).toBeVisible();
  });
});
