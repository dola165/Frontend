import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RouteRecoveryPage } from '../RouteRecoveryPage';

describe('RouteRecoveryPage', () => {
    it('explains contained feature routes and offers working destinations', () => {
        render(
            <MemoryRouter initialEntries={['/campaigns']}>
                <RouteRecoveryPage feature="Campaigns and fundraising" />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Campaigns and fundraising is outside this demo' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Browse clubs/ })).toHaveAttribute('href', '/clubs');
        expect(screen.getByRole('link', { name: /Explore the map/ })).toHaveAttribute('href', '/world');
    });

    it('returns a legacy club-store link to that club', () => {
        render(
            <MemoryRouter initialEntries={['/clubs/17/store']}>
                <Routes>
                    <Route path="/clubs/:id/store" element={<RouteRecoveryPage feature="The club store" />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByRole('link', { name: /Back to club/ })).toHaveAttribute('href', '/clubs/17');
    });

    it('gives unknown links a clear recovery path', () => {
        render(
            <MemoryRouter>
                <RouteRecoveryPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument();
    });
});
