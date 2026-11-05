import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RouteRecoveryPage } from '../RouteRecoveryPage';

describe('RouteRecoveryPage', () => {
    it('offers working destinations for an unknown link', () => {
        render(
            <MemoryRouter initialEntries={['/marketplace']}>
                <RouteRecoveryPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Browse clubs/ })).toHaveAttribute('href', '/world/clubs');
        expect(screen.getByRole('link', { name: /Explore the map/ })).toHaveAttribute('href', '/world');
    });

    it('returns a legacy club-store link to that club', () => {
        render(
            <MemoryRouter initialEntries={['/clubs/17/store']}>
                <Routes>
                    <Route path="/clubs/:id/store" element={<RouteRecoveryPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByRole('link', { name: /Back to club/ })).toHaveAttribute('href', '/clubs/17');
    });
});
