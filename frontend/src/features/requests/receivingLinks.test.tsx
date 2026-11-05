import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { InboxPanel } from '../../components/layout/header/inbox/InboxPanel';
import { homePendingDestination } from '../feed/homePendingDestinations';
import { safeNotificationLink } from '../../utils/notificationDestinations';
import { requestDestination, type RequestItem } from './api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'receiving-links' }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (en: string) => en }));

const welfare = '/clubs/1/office?tab=tools&tool=welfare&record=14';
beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear(); localStorage.setItem('gk-session-id', 'receiving-links');
});
afterEach(() => { cleanup(); localStorage.clear(); });

it.each([welfare, `${welfare}&squad=3`, '/clubs/9007199254740991/office?tab=tools&tool=welfare&record=9007199254740991&squad=9007199254740991'])('opens only the exact sealed welfare record: %s', value => {
    expect(requestDestination(value, 'WELFARE_WORK')).toBe(value);
    expect(homePendingDestination(value)).toBeNull();
    expect(safeNotificationLink(value)).toBeNull();
});

it.each([undefined, '', 'CLUB_OPERATION_WORK', 'WELFARE', 'welfare_work', 'WELFARE_WORK ', 'MEDICAL_WORK', 'UNKNOWN'])('rejects a welfare URL with absent or foreign family %s', family => {
    expect(requestDestination(welfare, family)).toBeNull();
});

const invalid = [
    ...['medical', 'concussion', 'consent', 'personal-case', 'WELFARE', 'welfare-case', 'welfare/14'].map(tool => welfare.replace('tool=welfare', `tool=${tool}`)),
    ...['0', '-1', '01', '+1', '1.0', '1e2', 'NaN', 'Infinity', '9007199254740992', '9'.repeat(400)].flatMap(id => [
        welfare.replace('/clubs/1/', `/clubs/${id}/`), welfare.replace('record=14', `record=${id}`), `${welfare}&squad=${id}`,
    ]),
    '/clubs/1/office', '/clubs/1/office?tab=tools&tool=welfare',
    welfare.replace('&record=14', '&itemId=14'), welfare.replace('/office?', '/workspace?'),
    welfare.replace('/office?', '/office/?'), welfare.replace('tab=tools&tool=welfare', 'tool=welfare&tab=tools'),
    welfare.replace('tab=tools', 'tab=overview'), welfare.replace('/clubs/1/', '/clubs/2/../1/'),
    welfare.replace('record=14', 'record=%31%34'), welfare.replace('welfare', '%77elfare'),
    welfare.replace('/clubs/1/', '/clubs/%31/'), welfare.replace('/office', '\\office'),
    `https://example.test${welfare}`, `//example.test${welfare}`, ` ${welfare}`, `${welfare}\n`, `${welfare}\t`,
    ...['&record=15', '&tool=welfare', '&tab=tools', '&squad=3&squad=4', '&next=/account', '&concernId=2', '&', '&squad=', '#private', '#', '?record=15', '&squad=%33'].map(tail => welfare + tail),
];
it.each(invalid)('rejects a malformed or broader sealed destination: %s', value => {
    expect(requestDestination(value, 'WELFARE_WORK')).toBeNull();
});

it.each([
    ['/clubs/1/office?tab=tools&tool=staff-duties&record=14', '/clubs/1/office?tab=tools&tool=staff-duties&record=14'],
    ['/clubs/1/office?tab=tools&tool=facilities&record=14&squad=3', '/clubs/1/office?tab=tools&tool=facilities&record=14&squad=3'],
    ['/projects/12', '/projects/12'], ['/me/staff-club', '/me/staff-club'], ['/calendar?eventId=3', '/calendar?eventId=3'],
    ['/club-operations?appointmentId=7', '/requests?appointmentId=7'],
    ['/notifications?venueId=2&bookingId=9', '/requests?view=updates&venueId=2&bookingId=9'],
])('preserves the existing route %s with and without family', (value, expected) => {
    for (const family of [undefined, 'CLUB_OPERATION_WORK', 'WELFARE_WORK', 'UNKNOWN']) expect(requestDestination(value, family)).toBe(expected);
});

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }

it.each([
    ['WELFARE_WORK', welfare, welfare], ['WELFARE_WORK', `${welfare}&squad=3`, `${welfare}&squad=3`],
    ['CLUB_OPERATION_WORK', welfare, '/requests?view=INCOMING'], ['UNKNOWN', welfare, '/requests?view=INCOMING'], ['', welfare, '/requests?view=INCOMING'],
    ['WELFARE_WORK', `${welfare}&record=15`, '/requests?view=INCOMING'],
    ['CLUB_OPERATION_WORK', welfare.replace('welfare', 'facilities'), welfare.replace('welfare', 'facilities')],
    ['CLUB_OPERATION_WORK', welfare.replace('welfare', 'staff-duties'), welfare.replace('welfare', 'staff-duties')],
])('uses the actual %s family and safe fallback in the header: %s', async (family, destination, expected) => {
    const item: RequestItem = { key: `${family}:14`, family, id: 14, title: 'Officer work', context: 'Dinamo · Scheduled', status: 'PENDING',
        direction: 'INCOMING', actionable: true, updatedAt: '', destination, actionLabel: 'Open work' };
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/notifications' ? { content: [] }
        : { items: [item], unavailableSources: [] } }));
    render(<MemoryRouter><InboxPanel counts={{ needsYou: 1, needsYouPartial: false, updates: 0 }} titleId="inbox" onNavigate={vi.fn()} /><Location /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: /Officer work/ });
    expect(link).toHaveAttribute('href', expected);
    fireEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent(expected);
    expect(screen.queryByRole('button', { name: /accept|confirm|approve/i })).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
});

it('clears sealed work when a refreshed header read is denied', async () => {
    let denied = false;
    vi.mocked(apiClient.get).mockImplementation(async url => {
        if (url === '/notifications') return { data: { content: [] } };
        if (denied) throw { response: { status: 403 } };
        return { data: { items: [{ key: 'WELFARE_WORK:14', family: 'WELFARE_WORK', actionable: true,
            title: 'Officer work', context: 'Dinamo', destination: welfare }], unavailableSources: [] } };
    });
    render(<MemoryRouter><InboxPanel counts={{ needsYou: 1, needsYouPartial: false, updates: 0 }} titleId="inbox" onNavigate={vi.fn()} /></MemoryRouter>);
    await screen.findByRole('link', { name: /Officer work/ });
    denied = true;
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('This part of your inbox could not load');
    expect(screen.queryByRole('link', { name: /Officer work/ })).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
});

it('round 2: a place offered to the family opens only its own case agreement, and only for that family', () => {
    const value = '/admissions/cases/4?tab=agreement&player=259';
    expect(requestDestination(value, 'ADMISSION_PLACE')).toBe(value);
    expect(requestDestination(value, 'CLUB_OPERATION_WORK')).toBeNull();
    for (const other of ['/admissions/cases/4', '/admissions/cases/4?tab=agreement&player=259&x=1', '/admissions/inquiries/4?tab=agreement&player=259', '/clubs/1/workspace'])
        expect(requestDestination(other, 'ADMISSION_PLACE')).toBeNull();
});
