import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PageView } from '../../pages/api';
import { makePage } from '../../pages/__tests__/fixtures';
import { ClubFacilitiesTab } from './ClubFacilitiesTab';
import type { ClubProfile } from './types';
import { ClubInfo } from './ClubInfo';

const state = vi.hoisted(() => ({ page: null as PageView | null }));
vi.mock('../../pages/edit/context', () => ({ usePageEditIfAny: () => state }));
vi.mock('../useOverviewSource', () => ({
    useOverviewSource: () => ({ data: [], loading: false, failed: false, retry: vi.fn() }),
}));

const club: ClubProfile = {
    id: 1, name: 'Dinamo', description: '', type: 'ACADEMY', isOfficial: false,
    statusLabel: 'Active', followerCount: 0, memberCount: 1,
    isFollowedByMe: false, isStaffMember: true, isMember: true,
    trustedByClubs: [], honours: [], opportunities: [],
};
function show(canEdit = true) {
    render(<MemoryRouter><ClubFacilitiesTab club={club} canEdit={canEdit} /></MemoryRouter>);
}
beforeEach(() => { state.page = null; });
afterEach(cleanup);

it('opens the real facilities workspace when the backend has no page-editor protocol', () => {
    show();
    expect(screen.getByRole('link', { name: 'Manage locations' })).toHaveAttribute('href', '/clubs/1/workspace?tab=facilities');
});
it('preserves the grounds editor when the current page confirms editing authority', () => {
    state.page = makePage({ kind: 'CLUB', ref: { type: 'club', id: 1 }, clubId: 1 });
    show();
    expect(screen.getByRole('link', { name: 'Manage locations' })).toHaveAttribute('href', '/clubs/1?edit=1&panel=grounds');
});
it('keeps a facilities appointment in its operational workspace when page editing is unavailable', () => {
    state.page = makePage({ viewer: { role: 'COACH', canEdit: false, editable: [], canClaim: false } });
    show();
    expect(screen.getByRole('link', { name: 'Manage locations' })).toHaveAttribute('href', '/clubs/1/workspace?tab=facilities');
});
it('does not offer management without the current server-confirmed facilities capability', () => {
    show(false);
    expect(screen.queryByRole('link', { name: 'Manage locations' })).not.toBeInTheDocument();
});
it('also connects the sidebar facility edit action to the real workspace', () => {
    render(<MemoryRouter><ClubInfo club={club} canEdit /></MemoryRouter>);
    const edits = screen.getAllByRole('link', { name: 'Edit' }).map(link => link.getAttribute('href'));
    expect(edits).toContain('/clubs/1/workspace?tab=facilities');
    expect(edits).not.toContain('/clubs/1?edit=1&panel=grounds');
});
