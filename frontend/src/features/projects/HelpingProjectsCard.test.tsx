import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { HelpingProjectsCard } from './HelpingProjectsCard';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));

const club = { id: 1, name: 'FC Dinamo Tbilisi Academy', crestUrl: null };

it('asks someone added by their address first, and Accept opens the project', async () => {
    api.get.mockResolvedValue({ data: [
        { projectId: 12, goal: 'Goals for Pitch 2', club, steps: [], pending: true, addedBy: 'Levan Gelashvili' },
        { projectId: 11, goal: 'New kit for U12', club, steps: [], pending: false, addedBy: null },
    ] });
    api.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><Routes><Route path="/" element={<HelpingProjectsCard />} /><Route path="/projects/:id" element={<p>Project page</p>} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Levan Gelashvili added you to Goals for Pitch 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New kit for U12/ })).toHaveAttribute('href', '/projects/11');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/12/helping/accept'));
    expect(await screen.findByText('Project page')).toBeInTheDocument();
});

it('Not for me takes the project off Home', async () => {
    api.get.mockResolvedValueOnce({ data: [{ projectId: 12, goal: 'Goals for Pitch 2', club, steps: [], pending: true, addedBy: 'Levan Gelashvili' }] })
        .mockResolvedValueOnce({ data: [] });
    api.post.mockResolvedValue({ data: {} });
    const { container } = render(<MemoryRouter><HelpingProjectsCard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Not for me' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/projects/12/helping/decline'));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
});
