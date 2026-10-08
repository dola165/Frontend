import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ mockMode: false }));
vi.mock('./extensions', async importOriginal => {
    const actual = await importOriginal<typeof import('./extensions')>();
    return {
        ...actual,
        resolveExtensionCapability: (key: import('./extensions').ExtensionCapabilityKey) =>
            actual.resolveExtensionCapability(key, runtime),
    };
});

import { ExtensionRoute, ExtensionSurface } from './ExtensionBoundary';

const mount = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('extension boundaries', () => {
    beforeEach(() => { runtime.mockMode = false; });

    it('replaces an unavailable direct route without mounting its feature', () => {
        const feature = vi.fn(() => <button>Publish shift</button>);
        const Feature = feature;
        mount(<ExtensionRoute capability="volunteerShifts"><Feature /></ExtensionRoute>);

        expect(screen.getByRole('heading', { name: 'Volunteer shifts is not available yet' })).toBeVisible();
        expect(screen.getByRole('link', { name: 'Browse roles' })).toHaveAttribute('href', '/jobs');
        expect(screen.queryByRole('button', { name: 'Publish shift' })).not.toBeInTheDocument();
        expect(feature).not.toHaveBeenCalled();
    });

    it('removes unavailable embedded controls entirely', () => {
        mount(<div>Supported content<ExtensionSurface capability="eventVenueAttachment"><button>Link reservation</button></ExtensionSurface></div>);
        expect(screen.getByText('Supported content')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Link reservation' })).not.toBeInTheDocument();
    });

    it('labels mock-backed surfaces as local demos', () => {
        runtime.mockMode = true;
        mount(<ExtensionRoute capability="volunteerShifts"><button>Reserve my place</button></ExtensionRoute>);
        expect(screen.getByRole('status')).toHaveTextContent('Local demo');
        expect(screen.getByRole('status')).toHaveTextContent('Nothing on this surface is stored by the production service.');
        expect(screen.getByRole('button', { name: 'Reserve my place' })).toBeVisible();
    });
});
