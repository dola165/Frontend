import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HiddenRecordNote, RecordPostCard, RecordPostChanges } from './RecordPostCard';
import type { FeedPostDto } from '../../components/feed/FeedPost';
import type { RecordPost } from './postTopics';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); });

const written = (record: Partial<RecordPost>) => ({
    id: 61, content: '', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', authorId: null, createdAt: '2026-10-29T08:45:00Z',
    record: { kind: 'TRIAL', moment: 'OPENED', recordId: 502, title: 'Open trial · U14 Girls', state: 'OPEN', action: 'APPLY', line: null, hidden: false, canChange: false, version: 3, ...record },
}) as unknown as FeedPostDto;
const show = (post: FeedPostDto) => render(<MemoryRouter><RecordPostCard post={post} /></MemoryRouter>);

it('shows the record and its one action: a trial opens its page to apply', () => {
    show(written({ placeName: 'Dinamo Academy Training Centre', ageGroup: 'U14' }));
    expect(screen.getByText('Open trial · U14 Girls')).toBeInTheDocument();
    expect(screen.getByText(/Dinamo Academy Training Centre · U14/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/tryouts/502');
});

it('labels a project’s amount as the club’s report, with its progress and Support', () => {
    show(written({ kind: 'PROJECT', moment: 'HALFWAY', recordId: 1201, title: 'New floodlights for Pitch 3', action: 'SUPPORT', reportedAmount: '31250', goalAmount: '45000', currency: 'GEL' }));
    expect(screen.getByText('New floodlights for Pitch 3 · halfway')).toBeInTheDocument();
    expect(screen.getByText('31,250 of 45,000 GEL · reported by the club')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '69% of the goal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/campaigns/1201');
});

it('keeps a closed record’s post with its state and no button', () => {
    show(written({ state: 'CLOSED', action: null }));
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
});

it('lets the club’s posters show a hidden post again in one click; others only see the mark', async () => {
    const bodies: unknown[] = [];
    server.use(http.put('*/posts/61/record', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(written({ hidden: false, canChange: true, version: 4, line: 'Bring boots' }));
    }));
    const saved = vi.fn();
    render(<HiddenRecordNote post={written({ hidden: true, canChange: true, line: 'Bring boots' })} onSaved={saved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show again' }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ line: 'Bring boots', mediaIds: null, hidden: false, version: 3 }]);
    expect(saved.mock.calls[0][0].record.hidden).toBe(false);
    cleanup();
    render(<HiddenRecordNote post={written({ hidden: true, canChange: false })} onSaved={saved} />);
    expect(screen.getByText('Hidden: only the club’s posters see it')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
});

it('keeps the photos already on a written post when staff add another; one leaves only when removed', async () => {
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:new'); static revokeObjectURL = vi.fn(); });
    const bodies: unknown[] = [];
    server.use(
        http.post('*/media/upload', () => HttpResponse.json({ id: 9 })),
        http.put('*/posts/61/record', async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json(written({ canChange: true, version: 4 })); }));
    const post = { ...written({ canChange: true, photoIds: [7] }), mediaUrls: ['/media/first.jpg'] } as FeedPostDto;
    const saved = vi.fn();
    const { container } = render(<RecordPostChanges post={post} onClose={() => {}} onSaved={saved} />);
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(1);
    fireEvent.change(container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File(['x'], 'second.png', { type: 'image/png' })] } });
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ line: null, mediaIds: [7, 9], hidden: false, version: 3 }]);
    vi.unstubAllGlobals();
});

it('saves a line alone without touching the photos', async () => {
    const bodies: unknown[] = [];
    server.use(http.put('*/posts/61/record', async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json(written({ canChange: true, version: 4 })); }));
    const post = { ...written({ canChange: true, photoIds: [7] }), mediaUrls: ['/media/first.jpg'] } as FeedPostDto;
    const saved = vi.fn();
    const { container } = render(<RecordPostChanges post={post} onClose={() => {}} onSaved={saved} />);
    fireEvent.change(container.ownerDocument.querySelector('textarea')!, { target: { value: 'Bring water' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ line: 'Bring water', mediaIds: null, hidden: false, version: 3 }]);
});
