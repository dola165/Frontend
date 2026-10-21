import i18n from '../../../i18n';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextUp } from '../hub/NextUp';
import { FamilySchedule } from '../FamilySchedule';
import * as api from '../../squadCommunication/api';
import { fetchClubSchedule } from '../../schedule/api';
import { apiClient } from '../../../api/axiosConfig';
import { setStoredAccessToken, setStoredUserId } from '../../../utils/authStorage';

vi.mock('../../schedule/api', () => ({ fetchClubSchedule: vi.fn() }));
vi.mock('../../squadCommunication/api', () => ({ spaces: vi.fn(), overview: vi.fn(), sessions: vi.fn(), attendance: vi.fn(), editSession: vi.fn(), createSession: vi.fn(), cancelSession: vi.fn() }));
vi.mock('../../mapPlanning/journeyScheduleData', async importOriginal => ({ ...await importOriginal<object>(), useJourneyEntries: () => ({ entries: [], error: '', loading: false }) }));
vi.mock('../../squadCommunication/SquadVenueReservationPanel', () => ({ SquadVenueReservationPanel: () => null }));

const nativeIntl = Intl;
function omitGeorgianDateData() {
    const limited = function (...[locales, options]: ConstructorParameters<typeof nativeIntl.DateTimeFormat>) {
        const requested = Array.isArray(locales) ? locales : [locales];
        return new nativeIntl.DateTimeFormat(requested.some(locale => String(locale).startsWith('ka')) ? 'en-GB' : locales, options);
    } as unknown as typeof nativeIntl.DateTimeFormat;
    limited.supportedLocalesOf = (locales, options) => nativeIntl.DateTimeFormat.supportedLocalesOf(locales, options).filter(locale => !locale.startsWith('ka'));
    vi.stubGlobal('Intl', Object.create(nativeIntl, { DateTimeFormat: { value: limited } }));
}

const NOW = new Date('2026-10-17T06:00:00.000Z');
const squads = [{ id: 10, club_id: 1, name: 'Fixture U12', can_manage: false }] as api.SquadOverview[];
const session: api.SquadSession = { id: 9, title: 'Fixture training stays English', description: 'Coach-provided note stays English',
    starts_at: '2026-10-19T12:00:23.123Z', ends_at: '2026-10-19T13:30:45.987Z', location: 'Fixture ground',
    status: 'SCHEDULED', cancellation_reason: null, revision: 4, response_requested: false,
    attendance: [{ id: 61, name: 'Nika', response: 'UNANSWERED', active: true }, { id: 62, name: 'Saba', response: 'UNANSWERED', active: true }] };
const mutationMethods = () => [api.attendance, api.editSession, api.createSession, api.cancelSession];
function ParentSurfaces({ playerId, from }: { playerId: number; from: Date }) {
    const location = useLocation();
    return <><NextUp squads={squads} playerId={playerId} childName={playerId === 61 ? 'Nika' : 'Saba'} />
        <FamilySchedule squads={squads} playerId={playerId} initialDate={from} embedded combined />
        <output data-testid="route">{location.pathname}{location.search}</output></>;
}
const show = (playerId = 61, from = NOW) => render(<MemoryRouter initialEntries={[`/parent?player=${playerId}`]}><ParentSurfaces playerId={playerId} from={from} /></MemoryRouter>);
const nextLink = () => screen.getByRole('link', { name: /Fixture training stays English/ });
const rangeHeading = () => document.querySelector('.gk-board__range') as HTMLElement;
// The day's column on the week board carries its weekday.
const dayOf = (element: HTMLElement) => element.closest('section') as HTMLElement;
const eventButton = () => screen.getByRole('button', { name: /Fixture training stays English/ });
const expectedHref = (playerId: number, at = session.starts_at) => `/squads/10?tab=schedule&session=9&at=${encodeURIComponent(at)}&player=${playerId}`;

beforeEach(async () => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); omitGeorgianDateData();
    await i18n.changeLanguage('en');
    setStoredAccessToken(`e30.${btoa(JSON.stringify({ sub: '20' }))}.test`); setStoredUserId(20);
    vi.mocked(api.sessions).mockResolvedValue([session]); vi.mocked(fetchClubSchedule).mockResolvedValue([]);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });
});
afterEach(async () => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); await i18n.changeLanguage('en'); });

it('updates Next and embedded Upcoming on EN→KA without changing child/session/time, reads or commands', async () => {
    const original = JSON.stringify(session); show();
    await screen.findByRole('button', { name: /Fixture training stays English/ });
    expect(nextLink()).toHaveTextContent('Monday'); expect(rangeHeading()).toHaveTextContent('17–23 October 2026');
    const reads = vi.mocked(api.sessions).mock.calls.length;
    await act(async () => { await i18n.changeLanguage('ka'); });
    expect(nextLink()).toHaveTextContent('ორშაბათი 19 ოქტ');
    expect(nextLink()).toHaveTextContent('16:00–17:30'); expect(nextLink()).toHaveAttribute('href', expectedHref(61));
    expect(rangeHeading()).toHaveTextContent('17–23 ოქტ 2026');
    expect(within(dayOf(eventButton())).getByText('ორშ')).toBeInTheDocument();
    expect(eventButton()).toHaveTextContent('16:00–17:30'); expect(eventButton().querySelector('time')).toHaveAttribute('dateTime', session.starts_at);
    expect(screen.getByTestId('route')).toHaveTextContent('/parent?player=61');
    expect(api.sessions).toHaveBeenCalledTimes(reads);
    for (const call of vi.mocked(api.sessions).mock.calls) expect(call[2]).toMatchObject({ playerId: 61 });
    expect(JSON.stringify(session)).toBe(original); for (const method of mutationMethods()) expect(method).not.toHaveBeenCalled();
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(nextLink()).toHaveTextContent('Monday'); expect(rangeHeading()).toHaveTextContent('17–23 October 2026');
});

it('freshly mounts Georgian for the selected sibling and opens the same read-only session context', async () => {
    await i18n.changeLanguage('ka'); show(62);
    await screen.findByRole('button', { name: /Fixture training stays English/ });
    expect(nextLink()).toHaveTextContent('ორშაბათი 19 ოქტ'); expect(nextLink()).toHaveAttribute('href', expectedHref(62));
    expect(rangeHeading()).toHaveTextContent('17–23 ოქტ 2026');
    fireEvent.click(eventButton());
    const dialog = within(screen.getByRole('dialog', { name: session.title }));
    expect(dialog.getByRole('region', { name: /Saba/ })).toBeInTheDocument();
    expect(dialog.queryByRole('region', { name: /Nika/ })).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /Edit or reschedule|შეცვლა ან გადატანა/ })).not.toBeInTheDocument();
    expect(dialog.getByText(session.description!)).toBeInTheDocument();
    expect(dialog.getByText(/16:00\s*–\s*17:30/)).toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent('/parent?player=62');
    for (const call of vi.mocked(api.sessions).mock.calls) expect(call[2]).toMatchObject({ playerId: 62 });
    for (const method of mutationMethods()) expect(method).not.toHaveBeenCalled();
});

it('retains the local date across a year boundary and midnight while linking the original UTC instant', async () => {
    const from = new Date('2026-12-30T06:00:00.000Z'); vi.setSystemTime(from); await i18n.changeLanguage('ka');
    const shifted = { ...session, starts_at: '2027-01-04T20:30:23.123Z', ends_at: '2027-01-04T22:00:45.987Z' };
    vi.mocked(api.sessions).mockResolvedValue([shifted]); show(62, from);
    await screen.findByRole('button', { name: /Fixture training stays English/ });
    expect(nextLink()).toHaveTextContent('სამშაბათი 5 იან'); expect(nextLink()).toHaveTextContent('00:30–02:00');
    expect(nextLink()).toHaveAttribute('href', expectedHref(62, shifted.starts_at));
    expect(rangeHeading()).toHaveTextContent('30 დეკ – 5 იან');
    expect(within(dayOf(eventButton())).getByText('სამ')).toBeInTheDocument();
    expect(eventButton().querySelector('time')).toHaveAttribute('dateTime', shifted.starts_at);
    expect(eventButton()).toHaveTextContent('00:30–02:00');
    for (const method of mutationMethods()) expect(method).not.toHaveBeenCalled();
});
