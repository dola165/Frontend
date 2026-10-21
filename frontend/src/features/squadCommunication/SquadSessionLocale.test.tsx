import i18n from '../../i18n';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SquadSessionDetails } from './SquadSessionDialog';
import { sessionEvent } from './useSquadSchedule';
import type { SquadSession } from './api';
import * as api from './api';
import { appLocale, formatDate } from '../../utils/formatting';
import { setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', () => ({ overview: vi.fn(), attendance: vi.fn(), createSession: vi.fn(), previewSession: vi.fn(), editSession: vi.fn(), previewCancellation: vi.fn(), cancelSession: vi.fn(), previewSeriesCancellation: vi.fn(), cancelSeries: vi.fn() }));
vi.mock('./SquadVenueReservationPanel', () => ({ SquadVenueReservationPanel: () => <section aria-label="Session reservation" /> }));

const nativeIntl = Intl;
function omitGeorgianDateData() {
    const limited = function (...[locales, options]: ConstructorParameters<typeof nativeIntl.DateTimeFormat>) {
        const requested = Array.isArray(locales) ? locales : [locales];
        return new nativeIntl.DateTimeFormat(requested.some(locale => String(locale).startsWith('ka')) ? 'en-GB' : locales, options);
    } as unknown as typeof nativeIntl.DateTimeFormat;
    limited.supportedLocalesOf = (locales, options) => nativeIntl.DateTimeFormat.supportedLocalesOf(locales, options).filter(locale => !locale.startsWith('ka'));
    vi.stubGlobal('Intl', Object.create(nativeIntl, { DateTimeFormat: { value: limited } }));
}

const squad = { id: 10, name: 'U12' };
const session: SquadSession = { id: 9, title: 'Fixture title stays English', description: 'Coach-provided note stays English',
    starts_at: '2026-10-19T12:00:23.123Z', ends_at: '2026-10-19T13:30:45.987Z', location: 'Fixture ground',
    status: 'SCHEDULED', cancellation_reason: null, revision: 4, response_requested: false,
    attendance: [{ id: 61, name: 'Nika', response: 'UNANSWERED', active: true }] };
const route = '/squads/10?tab=schedule&session=9&player=61&at=2026-10-19T12%3A00%3A23.123Z';
const saved = vi.fn(), closed = vi.fn();
function SelectedSession({ value = session }: { value?: SquadSession }) {
    const location = useLocation();
    return <><SquadSessionDetails event={sessionEvent(squad, value)} playerId={61} onSaved={saved} onClose={closed} />
        <output data-testid="route">{location.pathname}{location.search}</output></>;
}
const show = (value = session) => render(<MemoryRouter initialEntries={[route]}><SelectedSession value={value} /></MemoryRouter>);
const dateCard = () => within(document.querySelector('.session-time-card') as HTMLElement);

beforeEach(async () => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    omitGeorgianDateData(); await i18n.changeLanguage('en');
    setStoredAccessToken(`e30.${btoa(JSON.stringify({ sub: '20' }))}.test`); setStoredUserId(20);
});
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); await i18n.changeLanguage('en'); });

it('uses the existing Georgian calendar labels after EN→KA when native Intl falls back to English', async () => {
    const original = JSON.stringify(session); show();
    expect(dateCard().getByText('Monday')).toBeInTheDocument();
    expect(dateCard().getByText('19 October 2026')).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('ka'); });
    expect(appLocale()).toBe('ka-GE');
    expect(formatDate(session.starts_at, { weekday: 'long' })).toBe('Monday');
    expect(dateCard().getByText('ორშაბათი')).toBeInTheDocument();
    expect(dateCard().getByText('ოქტ', { exact: true })).toBeInTheDocument();
    expect(dateCard().getByText('19 ოქტ 2026')).toBeInTheDocument();
    expect(dateCard().getByText(/16:00\s*–\s*17:30/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
    expect(screen.getByText(session.description!)).toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent(route);
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(dateCard().getByText('19 October 2026')).toBeInTheDocument();
    expect(JSON.stringify(session)).toBe(original);
    expect(api.attendance).not.toHaveBeenCalled(); expect(api.editSession).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled(); expect(closed).not.toHaveBeenCalled();
});

it('starts a fresh selected-child session mount in Georgian without needing a language toggle', async () => {
    await i18n.changeLanguage('ka'); show();
    expect(dateCard().getByText('ორშაბათი')).toBeInTheDocument();
    expect(dateCard().getByText('19 ოქტ 2026')).toBeInTheDocument();
    expect(dateCard().getByText('Asia/Tbilisi')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Nika/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit or reschedule|შეცვლა ან გადატანა/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent(route);
    expect(api.attendance).not.toHaveBeenCalled(); expect(api.editSession).not.toHaveBeenCalled();
});

it('keeps the end date and clock for a session crossing local midnight in the fallback locale', async () => {
    await i18n.changeLanguage('ka'); show({ ...session, ends_at: '2026-10-19T20:30:45.987Z' });
    expect(dateCard().getByText(/16:00\s*–\s*20 ოქტ 2026, 00:30/)).toBeInTheDocument();
    expect(api.attendance).not.toHaveBeenCalled(); expect(api.editSession).not.toHaveBeenCalled();
});
