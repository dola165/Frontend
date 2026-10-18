import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ExtensionRoute, ExtensionSurface } from './ExtensionBoundary';

const mount = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('extension boundaries', () => {
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
});
