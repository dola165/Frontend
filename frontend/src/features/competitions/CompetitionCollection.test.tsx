import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompetitionDirectory from './CompetitionDirectory';
import { CompetitionEventCard } from './CompetitionEventCard';
import { browseCompetitions, defaultRules, type CompetitionCard } from './api';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }) }));
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), browseCompetitions: vi.fn() }));
vi.mock('./CompetitionHostPicker', () => ({ CompetitionHostPicker: () => null }));
const empty = { content: [], totalElements: 0, totalPages: 0, pageNumber: 0, pageSize: 8 };
function Location() { return <output aria-label="Current URL">{useLocation().search}</output>; }
const view = () => render(<MemoryRouter initialEntries={['/matches?section=overview&page=2']}><CompetitionDirectory overview/><Location/></MemoryRouter>);
const event: CompetitionCard = { id: 7, name: 'Academy Cup', description: null, status: 'PLANNING', participantScope: 'SQUAD', organizerName: 'Host academy', hostClubName: null, startDate: '2026-11-04', endDate: '2026-11-05', bannerImageUrl: null, entryCount: 3, entryCap: null, profile: { rules: null, legacy: true, revision: 0 } };

describe('Unified competition collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.mocked(browseCompetitions).mockResolvedValue(empty);
  });
  it('filters the overview in place, resets pagination and sends the selected football structure and entry type', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: /^Knockout cups/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Format' }), { target: { value: 'KNOCKOUT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Squads' }));
    await waitFor(() => expect(browseCompetitions).toHaveBeenCalled());
    const query = vi.mocked(browseCompetitions).mock.calls.at(-1)![0];
    expect(query.get('family')).toBe('CUP');expect(query.get('structure')).toBe('KNOCKOUT');expect(query.get('scope')).toBe('SQUAD');expect(query.has('page')).toBe(false);
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('section=overview');
    fireEvent.click(screen.getByRole('button', { name: /^Football festivals/ }));
    await waitFor(() => expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].get('family')).toBe('FESTIVAL'));
    expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].has('structure')).toBe(false);
  });
  it('preserves URL filters while changing layout and exposes advanced controls on demand', async () => {
    view();await screen.findByText('No competitions match this search');
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('display=list');
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox', { name: 'Age group' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    expect(screen.getByRole('combobox', { name: 'Age group' })).toBeVisible();
  });
  it('uses labelled stock without inventing a format, fee or venue for a legacy event', () => {
    render(<MemoryRouter><CompetitionEventCard event={event} returnTo="/matches"/></MemoryRouter>);
    expect(screen.getByText('Format details from the host')).toBeVisible();
    expect(screen.queryByText(/Free entry|spots remaining|Sanctioned|Illustrative football photo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Football stock photo')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Academy Cup' })).toHaveAttribute('href', '/tournaments/7');
  });
  it('distinguishes groups and finals from knockout cups and resets both filters atomically', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: /^Groups & finals/ }));
    await waitFor(() => expect(vi.mocked(browseCompetitions).mock.calls.at(-1)?.[0].get('structure')).toBe('GROUPS_KNOCKOUT'));
    expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].get('family')).toBe('CUP');
    expect(screen.getByRole('button', { name: /^Groups & finals/ })).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('button', { name: /^Knockout cups/ })).toHaveAttribute('aria-pressed','false');
    fireEvent.click(screen.getByRole('button', { name: 'Show all formats' }));
    await waitFor(() => expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].has('structure')).toBe(false));
    expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].has('family')).toBe(false);
  });
  it('changes page size and resets the URL page in one update', async () => {
    vi.mocked(browseCompetitions).mockResolvedValue({ content: [event], totalElements: 20, totalPages: 3, pageNumber: 2, pageSize: 8 });
    view();
    const size = await screen.findByRole('combobox', { name: 'Results per page' });
    expect(screen.queryByRole('option', { name: '30' })).not.toBeInTheDocument();
    fireEvent.change(size, { target: { value: '24' } });
    await waitFor(() => expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].get('size')).toBe('24'));
    expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].has('page')).toBe(false);
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('section=overview');
  });
  it('shows actual age, playing format, fee basis and capacity when published', () => {
    render(<MemoryRouter><CompetitionEventCard event={{ ...event, entryCap: 16, profile: { legacy: false, revision: 1, rules: { ...defaultRules(), ageGroup: 'U12', sideSize: 7, entryFee: 40, currency: 'GEL', feeBasis: 'TEAM' } } }} returnTo="/matches"/></MemoryRouter>);
    expect(screen.getByText('U12 · 7v7')).toBeVisible();expect(screen.getByText('40 GEL / team')).toBeVisible();expect(screen.getByText('3 / 16 entries')).toBeVisible();
  });
  it('keeps cards, pagination and keyboard focus mounted through a slow page-size change', async () => {
    const initial = { ...empty, content: [event], totalElements: 20, totalPages: 3, pageNumber: 0 };
    vi.mocked(browseCompetitions).mockResolvedValueOnce(initial);
    let finish!: (value: typeof initial) => void;
    vi.mocked(browseCompetitions).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    view();
    const size = await screen.findByRole('combobox', { name: 'Results per page' });
    const card = screen.getByRole('link', { name: 'Academy Cup' });
    size.focus();fireEvent.change(size, { target: { value: '24' } });
    await waitFor(() => expect(browseCompetitions).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('link', { name: 'Academy Cup' })).toBe(card);
    expect(screen.getByRole('combobox', { name: 'Results per page' })).toBe(size);
    expect(size).toHaveFocus();expect(size).toHaveValue('24');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(browseCompetitions).toHaveBeenCalledTimes(2);
    await act(async () => finish({ ...initial, pageSize: 24, totalPages: 1 }));
    expect(size).toHaveFocus();expect(screen.getByText('Page 1 of 1')).toBeVisible();
  });
  it('retains the last results on failure and retries the requested query', async () => {
    vi.mocked(browseCompetitions).mockResolvedValueOnce({ ...empty, content: [event], totalElements: 20, totalPages: 3 });
    vi.mocked(browseCompetitions).mockRejectedValueOnce(new Error('Offline'));
    view();await screen.findByRole('link', { name: 'Academy Cup' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('link', { name: 'Academy Cup' })).toBeVisible();
    vi.mocked(browseCompetitions).mockResolvedValueOnce({ ...empty, content: [{ ...event, id: 8, name: 'Next Cup' }], totalElements: 20, totalPages: 3, pageNumber: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: 'Next Cup' });
    expect(vi.mocked(browseCompetitions).mock.calls.at(-1)![0].get('page')).toBe('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('changing grid/list presentation keeps the current page and does not refetch', async () => {
    vi.mocked(browseCompetitions).mockResolvedValue({ ...empty, content: [event], totalElements: 20, totalPages: 3, pageNumber: 2 });
    view();await screen.findByRole('link', { name: 'Academy Cup' });
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('page=2');
    expect(screen.getByRole('link', { name: 'Academy Cup' })).toBeVisible();
    expect(browseCompetitions).toHaveBeenCalledTimes(1);
  });
});
