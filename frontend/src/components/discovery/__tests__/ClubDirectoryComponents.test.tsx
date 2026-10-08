import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { ClubDirectoryFilters } from '../ClubDirectoryFilters';
import { ClubDirectoryResult } from '../ClubDirectoryResult';
import { getClubAccentStyle } from '../clubDirectoryMappings';
import type { ClubProfile } from '../clubDirectoryTypes';

const club: ClubProfile = {
    id: 7,
    name: 'Test Club',
    description: 'A club for testing',
    type: 'GRASSROOTS',
    isOfficial: true,
    followerCount: 12,
    memberCount: 24,
    isFollowedByMe: false,
    cityName: 'Tbilisi',
    joinPolicy: 'OPEN_TRIAL',
    relationshipState: 'NONE'
};

describe('Club Directory presentational building blocks', () => {
    it('keeps identity accents deterministic for missing logos', () => {
        expect(getClubAccentStyle(club)).toEqual(getClubAccentStyle({ id: 7, name: 'Test Club' }));
        expect(getClubAccentStyle(club).backgroundColor).toMatch(/^#/);
    });

    it('renders the compact result and forwards follow actions', () => {
        const onFollowToggle = vi.fn();
        render(
            <MemoryRouter>
                <ClubDirectoryResult
                    club={club}
                    authStatus="authenticated"
                    joiningClubId={null}
                    applyingClubId={null}
                    onJoin={vi.fn()}
                    onApply={vi.fn()}
                    onFollowToggle={onFollowToggle}
                />
            </MemoryRouter>
        );

        expect(screen.getByText('OPEN TRIAL')).toHaveClass('text-[color:var(--color-accent)]');
        expect(screen.getByText('Tbilisi')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /follow/i }));
        expect(onFollowToggle).toHaveBeenCalledWith(expect.anything(), 7);
    });

    it('keeps filter controls controlled and emits explicit changes', () => {
        const onToggleType = vi.fn();
        const onClearFilters = vi.fn();
        const { rerender } = render(
            <ClubDirectoryFilters
                selectedTypes={[]}
                selectedPolicies={[]}
                city=""
                country=""
                hasActiveFilters
                onCityChange={vi.fn()}
                onCountryChange={vi.fn()}
                onToggleType={onToggleType}
                onTogglePolicy={vi.fn()}
                onClearFilters={onClearFilters}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
        expect(onClearFilters).toHaveBeenCalledTimes(1);

        rerender(
            <ClubDirectoryFilters
                selectedTypes={[]}
                selectedPolicies={[]}
                city=""
                country=""
                hasActiveFilters={false}
                onCityChange={vi.fn()}
                onCountryChange={vi.fn()}
                onToggleType={onToggleType}
                onTogglePolicy={vi.fn()}
                onClearFilters={vi.fn()}
            />
        );
        expect(screen.getByRole('button', { name: 'ACADEMY' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'ACADEMY' }));
        expect(onToggleType).toHaveBeenCalledWith('ACADEMY');
    });
});
