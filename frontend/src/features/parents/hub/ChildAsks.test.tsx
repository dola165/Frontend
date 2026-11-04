import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildAsks } from './ChildAsks';
import type { JoiningChild } from '../api';
import type { Ask } from './familyAsks';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));

const child = { playerId: 7, identity: { fullName: 'Teo Teen', positions: [] }, clubs: [], cases: [] } as unknown as JoiningChild;
const ask = (over: Partial<Ask>): Ask => ({ key: over.kind ?? 'PHOTOS', kind: 'PHOTOS', clubId: 1, clubName: 'Dinamo', crestUrl: null, recordId: null, revision: null, title: null, wording: null, purpose: null, answer: 'WAITING', answeredBy: null, answeredAt: null, canAnswer: true, note: null, ...over });
const page = (onChanged = vi.fn()) => render(<MemoryRouter><ChildAsks child={child} revision={0} onChanged={onChanged} /></MemoryRouter>);

describe('ChildAsks', () => {
    beforeEach(() => { api.get.mockReset(); api.post.mockReset(); });

    it('shows Yes and No in place and answers there, showing who answered', async () => {
        api.get.mockResolvedValue({ data: [ask({ kind: 'PHOTOS' }), ask({ kind: 'TRIPS' }), ask({ kind: 'MEDICAL' })] });
        api.post.mockResolvedValue({ data: [ask({ kind: 'PHOTOS', answer: 'YES', answeredBy: 'Maia', answeredAt: '2026-11-04T10:00:00Z', revision: 0, recordId: 5 }), ask({ kind: 'TRIPS' }), ask({ kind: 'MEDICAL' })] });
        const onChanged = vi.fn();
        page(onChanged);
        expect(await screen.findByText('Photos of Teo')).toBeVisible();
        expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(3);
        expect(screen.getAllByRole('button', { name: 'No' })[0]).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/family/children/7/asks', { clubId: 1, kind: 'PHOTOS', recordId: null, revision: null, yes: true, note: undefined }));
        expect(onChanged).toHaveBeenCalled();
        expect(await screen.findByText(/Your answers · 1/)).toBeVisible();
        expect(screen.getByText(/Yes · Maia/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    });

    it('asks for the note before a yes to the coach counts', async () => {
        api.get.mockResolvedValue({ data: [ask({ kind: 'MEDICAL' })] });
        api.post.mockResolvedValue({ data: [ask({ kind: 'MEDICAL', answer: 'YES', answeredBy: 'Maia', note: 'Asthma', revision: 0, recordId: 5 })] });
        page();
        fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
        expect(api.post).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('What should the coach know?'), { target: { value: 'Asthma' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tell the coach' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/family/children/7/asks', expect.objectContaining({ kind: 'MEDICAL', yes: true, note: 'Asthma' })));
    });

    it('shows the server’s words when another parent answered first, and reloads', async () => {
        api.get.mockResolvedValue({ data: [ask({ kind: 'PHOTOS' })] });
        api.post.mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Gia already answered this. Open it again, and change it if you see it differently.' } } });
        page();
        fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Gia already answered');
        await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    });

    it('offers a door to a concern, and keeps it with nothing to ask', async () => {
        api.get.mockResolvedValue({ data: [ask({ kind: 'PHOTOS' })] });
        const { unmount } = page();
        const door = await screen.findByRole('link', { name: /Raise a concern/ });
        expect(door.getAttribute('href')).toContain('concern=1');
        expect(door.getAttribute('href')).toContain('player=7');
        unmount();
        api.get.mockResolvedValue({ data: [] });
        const { container } = page();
        expect(await screen.findByRole('link', { name: /Raise a concern/ })).toBeVisible();
        expect(container.querySelector('.ph-asks')).toBeNull();
    });
});
