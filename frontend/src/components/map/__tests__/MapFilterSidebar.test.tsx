import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MapFilterSidebar, defaultMapFilters, type MapFilters } from '../MapFilterSidebar';

const Harness = ({ viewerMode = 'player' }: { viewerMode?: 'player' | 'staff' }) => {
    const [filters, setFilters] = useState<MapFilters>(defaultMapFilters);
    return (
        <MapFilterSidebar
            isVisible
            draftFilters={filters}
            appliedFilters={defaultMapFilters}
            onDraftChange={setFilters}
            onApply={vi.fn()}
            onResetAll={() => setFilters(defaultMapFilters)}
            applying={false}
            resultCount={7}
            placeSearch=""
            onPlaceSearchChange={vi.fn()}
            onClose={vi.fn()}
            allowedEntityTypes={viewerMode === 'player' ? ['CLUB'] : ['CLUB', 'MATCH', 'TOURNAMENT']}
            viewerMode={viewerMode}
        />
    );
};

describe('MapFilterSidebar', () => {
    it('keeps player essentials visible without exposing event types', async () => {
        const user = userEvent.setup();
        render(<Harness />);

        expect(screen.getByText('Show on map')).toBeInTheDocument();
        expect(screen.getByText('Player discovery')).toBeInTheDocument();
        expect(screen.getByText('My player fit')).toBeInTheDocument();
        expect(screen.getByText('Position needed')).toBeInTheDocument();
        expect(screen.queryByText('Club type')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Goalkeeper' }));
        expect(screen.getByTitle('Remove Goalkeeper')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show updated results' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Club filters/ }));
        expect(screen.getByText('Club type')).toBeInTheDocument();
    });

    it('shows role-aware staff presets', () => {
        render(<Harness viewerMode="staff" />);
        expect(screen.getByText('Staff operations')).toBeInTheDocument();
        expect(screen.queryByText('My player fit')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Recruit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Fixtures' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument();
    });
});
