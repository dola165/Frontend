import '../../../i18n';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubPeopleTab } from '../profile/ClubPeopleTab';
import { staffMatchesSquad, type PublicResponsibility, type PublicStaff } from '../publicJourney';
import { responsibilityAreas, staffAreas } from '../staffAreas';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: api }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: null, sessionId: 'visitor', status: 'anonymous' }) }));

// Published record5008 from the combined334 review; department classification must retain these exact scopes.
const psychologist: PublicStaff = {
  userId: 5008, fullName: 'Ia Shengelia', avatarUrl: '/sandbox-media/avatar/5008.svg', role: 'CLUB_STAFF', title: 'Sports psychologist', bio: null,
  responsibilities: [{ title: 'Sports psychologist', specialisations: ['PSYCHOLOGIST'], squadId: 105, squadName: 'U16 Boys',
    squadIds: [105, 106, 107, 108], squadNames: ['U16 Boys', 'U16 Girls', 'U18 Boys', 'Dinamo Youth A'], clubWide: false,
    provenance: 'RECORDED_APPOINTMENT', startsOn: '2026-05-20', endsOn: null }],
};
const managerAppointment: PublicResponsibility = { title: 'Team manager', specialisations: ['TEAM_MANAGER'], squadId: 104, squadName: 'U14 Girls', squadIds: [104], squadNames: ['U14 Girls'], clubWide: false, provenance: 'RECORDED_APPOINTMENT', startsOn: '2026-01-01', endsOn: null };
const manager: PublicStaff = { userId: 5010, fullName: 'Operations colleague', role: 'CLUB_ADMIN', title: 'Team manager', responsibilities: [managerAppointment] };
const physio: PublicStaff = { userId: 5007, fullName: 'Club physiotherapist', role: 'CLUB_STAFF', title: 'Physiotherapist', responsibilities: [{ ...managerAppointment, title: 'Physiotherapist', specialisations: ['PHYSIOTHERAPIST'], squadId: null, squadName: null, squadIds: [], squadNames: [], clubWide: true }] };
function mount(people: PublicStaff[], query = '') {
  api.get.mockResolvedValue({ data: people });
  render(<MemoryRouter initialEntries={[`/clubs/1?tab=people${query}`]}><ClubPeopleTab clubId={1} clubName="Public academy" canManageStaff={false} /></MemoryRouter>);
}
beforeEach(() => { vi.resetAllMocks(); });

it('classifies the recorded psychologist as care without changing the record or squad authority', () => {
  const before = structuredClone(psychologist);
  expect(responsibilityAreas(psychologist.responsibilities[0].specialisations)).toEqual(['care']);
  expect(staffAreas(psychologist)).toEqual(['care']);
  for (const id of [105, 106, 107, 108]) expect(staffMatchesSquad(psychologist, String(id))).toBe(true);
  expect(staffMatchesSquad(psychologist, '104')).toBe(false);
  expect(psychologist).toEqual(before);
});

it('does not turn an administrative responsibility or an unrecorded title into care', () => {
  expect(staffAreas(manager)).toEqual(['operations']);
  expect(staffAreas({ ...psychologist, responsibilities: [] })).toEqual(['operations']);
  expect(manager.role).toBe('CLUB_ADMIN');
});

it('shows record5008 in the public care filter and preserves assigned versus unrelated squad filtering', async () => {
  mount([psychologist, physio, manager], '&staff=care');
  await screen.findByRole('link', { name: 'Ia Shengelia' });
  const care = within(screen.getByRole('region', { name: 'Medical & player care' }));
  expect(care.getByRole('link', { name: 'Club physiotherapist' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Operations colleague' })).not.toBeInTheDocument();
  const person = within(care.getByRole('link', { name: 'Ia Shengelia' }).closest('article')!);
  fireEvent.click(person.getByText('Details', { selector: 'summary' }));
  const published = within(person.getByRole('list', { name: 'Published responsibilities' }));
  expect(published.getAllByRole('listitem')).toHaveLength(1);
  expect(published.getByText('U16 Boys · U16 Girls · U18 Boys · Dinamo Youth A')).toBeVisible();
  const squads = screen.getByRole('combobox', { name: 'Squad' });
  fireEvent.change(squads, { target: { value: '104' } });
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Ia Shengelia' })).not.toBeInTheDocument());
  expect(screen.getByRole('link', { name: 'Club physiotherapist' })).toBeVisible();
  fireEvent.change(squads, { target: { value: '106' } });
  expect(await screen.findByRole('link', { name: 'Ia Shengelia' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Manage staff' })).not.toBeInTheDocument();
  expect(api.put).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

it('retains a real second operations responsibility while showing each appointment only in its department', async () => {
  const person: PublicStaff = { ...psychologist, responsibilities: [...psychologist.responsibilities, managerAppointment] };
  expect(staffAreas(person)).toEqual(['care', 'operations']);
  mount([person]);
  await screen.findByRole('region', { name: 'Medical & player care' });
  const care = within(screen.getByRole('region', { name: 'Medical & player care' }));
  const operations = within(screen.getByRole('region', { name: 'Club operations' }));
  expect(care.getAllByRole('link', { name: 'Ia Shengelia' })).toHaveLength(1);
  expect(operations.getAllByRole('link', { name: 'Ia Shengelia' })).toHaveLength(1);
  fireEvent.click(care.getByText('Details', { selector: 'summary' }));
  fireEvent.click(operations.getByText('Details', { selector: 'summary' }));
  expect(care.getByRole('list', { name: 'Published responsibilities' })).toHaveTextContent('Sports psychologist');
  expect(care.getByRole('list', { name: 'Published responsibilities' })).not.toHaveTextContent('Team manager');
  expect(operations.getByRole('list', { name: 'Published responsibilities' })).toHaveTextContent('Team manager');
  expect(operations.getByRole('list', { name: 'Published responsibilities' })).not.toHaveTextContent('Sports psychologist');
  expect(person.role).toBe('CLUB_STAFF');
});
