import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { TabContact } from '../TabContact';
import type { ClubProfile } from '../../../../pages/ClubProfilePage';

const club = {
    id: 10,
    name: 'Alpha FC',
    description: '',
    type: 'Football club',
    isOfficial: true,
    statusLabel: 'Verified',
    followerCount: 0,
    memberCount: 0,
    isFollowedByMe: false,
    isStaffMember: false,
    isMember: false,
    trustedByClubs: [],
    honours: [],
    opportunities: [],
} as ClubProfile;

it('keeps exact role context in the contact handoff without claiming an application', () => {
    render(<MemoryRouter initialEntries={['/clubs/10?tab=contact&roleId=41&roleTitle=Volunteer+coordinator']}><TabContact club={club}/></MemoryRouter>);
    const context = screen.getByLabelText('Role contact context');
    expect(context).toHaveTextContent('Contact Alpha FC about Volunteer coordinator');
    expect(context).toHaveTextContent('No in-app application has been submitted or tracked');
    expect(screen.getByRole('link', { name: 'Return to role' })).toHaveAttribute('href', '/jobs/41');
});
