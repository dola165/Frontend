import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PostAuthor } from '../../../feed/postAuthors';
import type { ClubProfile } from '../types';

let authors: PostAuthor[] = [];
vi.mock('../../../feed/postAuthors', () => ({ usePostAuthors: () => ({ authors, loaded: true }) }));
vi.mock('../../../profiles/useProfilePostFeed', () => ({ useProfilePostFeed: () => ({ pages: { refresh: () => {} } }) }));
vi.mock('../../../profiles/ProfilePosts', () => ({ ProfilePosts: () => <p>posts</p> }));
vi.mock('../../../announcements/ClubAnnouncementsBox', () => ({ ClubAnnouncementsBox: () => null }));
vi.mock('../../../clubOffice/recordPostSwitches', async importOriginal => ({
    ...await importOriginal<typeof import('../../../clubOffice/recordPostSwitches')>(),
    useRecordPostSwitches: () => ({ switches: { kinds: [{ kind: 'TRIAL', on: true }, { kind: 'JOB', on: false }], version: 2, canChange: true },
        failed: false, busy: false, changedElsewhere: false, reload: () => {}, toggle: async () => {} }),
}));
const { ClubPostsTab } = await import('../ClubPostsTab');
afterEach(cleanup);

const club = { id: 1, name: 'FC Dinamo Tbilisi Academy', logoUrl: null } as unknown as ClubProfile;
const show = () => render(<MemoryRouter><ClubPostsTab club={club} /></MemoryRouter>);
const dinamo = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', squadId: null, name: 'FC Dinamo Tbilisi Academy' };

it('lets whoever posts for the whole club reach the switches from the Posts tab', () => {
    authors = [{ ...dinamo, leadership: false }];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Posts from the club’s work' }));
    expect(screen.getByRole('switch', { name: /Trials/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Jobs and volunteering/ })).not.toBeChecked();
});

it('shows a squad’s coach no switches', () => {
    authors = [{ ...dinamo, squadId: 105, name: 'U16 Boys' }];
    show();
    expect(screen.queryByRole('button', { name: 'Posts from the club’s work' })).toBeNull();
});
