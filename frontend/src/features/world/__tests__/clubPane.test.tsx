import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { CareerEntry } from '../../roles/domain';
import { clubPartPage, clubParts, clubTab, squadsOf, type ClubExtras, type PaneClub } from '../peek/club/clubPane';
import { PersonCareer } from '../peek/PersonCareer';

const club = { id: 4, name: 'Riverside Academy', presentation: null, honours: [], websiteUrl: null } as unknown as PaneClub;
const none: ClubExtras = { squads: [], coaches: [], management: [], venues: [], jobs: [], trials: [], trialCount: 0, next: [], results: [], failed: false };
const staff = (userId: number) => ({ userId, fullName: `Person ${userId}`, role: 'COACH', responsibilities: [] });

describe('the club pane', () => {
    it('has a tab only for the parts of the club that have something in them', () => {
        expect(clubParts(club, none)).toEqual([]);
        const parts = clubParts({ ...club, websiteUrl: 'https://riverside.example' }, { ...none, squads: [{ id: 1, name: 'U10 Boys', category: 'U10' }], coaches: [staff(9)] });
        expect(parts.map(part => part.label)).toEqual(['Teams & training', 'Coaches', 'Contact']);
        expect(clubParts(club, { ...none, management: [staff(3)] })).toEqual([{ id: 'management', label: 'Management' }]);
    });

    it("opens the club's page at the tab shown, keeping the child a parent is searching for", () => {
        expect(clubPartPage(4, 'coaches')).toBe('/clubs/4?tab=people&staff=coaching');
        expect(clubPartPage(4, 'teams', '501')).toBe('/clubs/4?tab=teams&player=501');
        expect(clubPartPage(4, 'matches')).toBeUndefined();
        expect(clubTab(4, 'teams', { squad: '11' }, '501')).toBe('/clubs/4?tab=teams&squad=11&player=501');
    });

    it('knows which teams each coach has, from their published responsibilities', () => {
        const coach = { ...staff(9), responsibilities: [{ title: 'Head coach', specialisations: [], squadId: null, squadName: null, squadIds: [1, 2], squadNames: ['U10 Boys', 'U12 Girls'], startsOn: '2026-01-01', endsOn: null }] };
        expect(squadsOf(coach)).toEqual([{ id: 1, name: 'U10 Boys' }, { id: 2, name: 'U12 Girls' }]);
    });
});

const entry = (id: number, kind: CareerEntry['kind'], title: string, startsOn: string, endsOn: string | null = null): CareerEntry =>
    ({ id, role: 'COACH', kind, title, organization: 'Saburtalo', startsOn, endsOn, description: null, published: true });

describe("a person's career in the pane", () => {
    it('lists experience newest first with its years, and links to the Career tab only when there is one', () => {
        render(<MemoryRouter><PersonCareer entries={[entry(1, 'POSITION', 'Assistant coach', '2014-08-01', '2016-06-30'), entry(2, 'POSITION', 'Head coach', '2016-07-01'), entry(3, 'QUALIFICATION', 'UEFA A', '2019-05-01')]} link="/profile/1?tab=career" /></MemoryRouter>);
        const titles = screen.getAllByText(/coach$/).map(node => node.textContent);
        expect(titles).toEqual(['Head coach', 'Assistant coach']);
        expect(screen.getByText('Saburtalo · 2016 – now')).toBeTruthy();
        expect(screen.getByText('Saburtalo · 2019')).toBeTruthy();
        expect(screen.getByRole('link', { name: /View career/ }).getAttribute('href')).toBe('/profile/1?tab=career');
    });

    it('shows nothing when the person published no career', () => {
        const { container } = render(<MemoryRouter><PersonCareer entries={[]} /></MemoryRouter>);
        expect(container.textContent).toBe('');
    });
});
