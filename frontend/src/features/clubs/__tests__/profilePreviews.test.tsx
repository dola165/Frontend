import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ClubProfilePreviews } from '../ClubProfilePreviews';
import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import { clubPreviewTarget, type ClubPreviewTarget } from '../clubProfilePreviewRoutes';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

vi.mock('../ClubPreviewContent', () => ({ ClubPreviewContent: ({ target }: { target: ClubPreviewTarget }) => <Detail target={target}/> }));
function Detail({ target }: { target: ClubPreviewTarget }) {
  const [params, setParams] = useClubProfileSearchParams();
  const [note, setNote] = useState('');
  return <><input aria-label={`${target.title} note`} value={note} onChange={e => setNote(e.target.value)}/><input aria-label="Panel filter" value={params.get('q') || ''} onChange={e => { const next = new URLSearchParams(params); next.set('q', e.target.value); setParams(next); }}/><Link to="/clubs/1?tab=people&squad=9">Related coaches</Link><Link to="/clubs/1?tab=facilities&squad=9">Related facilities</Link></>;
}
const club = { id: 1, name: 'Dinamo Academy' } as ClubProfile;
function Page() {
  const location = useLocation();
  return <><output data-testid="location">{location.pathname}{location.search}</output><ClubProfilePreviews club={club}><input aria-label="Training search" defaultValue="Under 12"/><Link to="/clubs/1?tab=teams&programme=22">Programme details</Link><Link to="/clubs/1?tab=schedule">See schedule</Link><Link to="/clubs/1?tab=facilities">Find ground</Link><Link data-club-full-page to="/clubs/1/workspace">Open workspace</Link><Link to="/clubs/1?tab=events" data-club-full-page>Go to Events tab</Link><a href="https://external.example/club" target="_blank">Club website</a></ClubProfilePreviews></>;
}
const setup = () => render(<MemoryRouter initialEntries={['/clubs/1?tab=teams&q=Under+12&age=10']}><Page/></MemoryRouter>);
const open = () => { const link = screen.getByRole('link', { name: 'Find ground' }); link.focus(); fireEvent.click(link); return link; };

describe('club detail panels', () => {
  it('keeps the primary training detail in the centre', () => {
    setup(); fireEvent.click(screen.getByRole('link', {name:'Programme details'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/clubs/1?tab=teams&programme=22');
  });
  it('keeps the current tab and its filters and restores focus on close', async () => {
    setup(); const trigger = open();
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/clubs/1?tab=teams&q=Under+12&age=10');
    fireEvent.change(screen.getByLabelText('Panel filter'), { target: { value: 'Keep in panel' } });
    expect(screen.getByTestId('location')).toHaveTextContent('q=Under+12&age=10');
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Training search')).toHaveValue('Under 12');
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('restores a nested panel without losing its local input, filters, scroll or focus', async () => {
    setup(); open(); await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Facilities note'), { target: { value: 'Unsaved question' } });
    fireEvent.change(screen.getByLabelText('Panel filter'), { target: { value: 'U12' } });
    const firstBody = screen.getByLabelText('Facilities note').closest('.club-preview-body')!;
    firstBody.scrollTop = 120;
    const related = screen.getByRole('link', { name: 'Related coaches' }); related.focus(); fireEvent.click(related);
    expect(screen.getByLabelText('Coaches & staff note')).toBeVisible();
    expect(firstBody).not.toBeVisible();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Facilities' }));
    expect(screen.getByLabelText('Facilities note')).toHaveValue('Unsaved question');
    expect(screen.getByLabelText('Panel filter')).toHaveValue('U12');
    expect(firstBody.scrollTop).toBe(120);
    expect(related).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Find ground' })).toHaveFocus();
  });

  it('only leaves for the explicit full-tab action', async () => {
    setup(); fireEvent.click(screen.getByRole('link', { name: 'See schedule' }));
    const dialog = await screen.findByRole('dialog');
    expect(screen.getByTestId('location')).toHaveTextContent('tab=teams');
    fireEvent.change(screen.getByLabelText('Panel filter'), { target: { value: 'U12' } });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Go to Schedule tab' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/clubs/1?tab=schedule&q=U12');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open workspace' })).not.toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('link', { name: 'Open workspace' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/clubs/1/workspace');
  });

  it('preserves browser modifier-click intent', () => {
    setup(); fireEvent.click(screen.getByRole('link', { name: 'Find ground' }), { ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('preview destination policy', () => {
  const base = 'https://app.grasskickz.com/clubs/1?tab=teams';
  it.each(['/clubs/1?tab=facilities&squad=9', '/clubs/2', '/profile/22', '/stadiums/3', '/posts/8?media=1', '/jobs/9', '/campaigns/7', '/store/products/2', '/match-exchange/355#result', '/calendar?eventId=355', '/clubs/1/store', '/clubs/1/campaigns', '/match-history?clubId=1'])('previews the read destination %s', path => expect(clubPreviewTarget(path, base)).not.toBeNull());
  it.each(['/clubs/1/workspace', '/clubs/1/profile-settings', '/calendar', '/messages', '/login', '/clubs/1?managementTab=personnel', 'https://external.example/clubs/1', 'javascript:alert(1)', '//external.example/profile/1'])('leaves explicit work destinations and external links alone: %s', path => expect(clubPreviewTarget(path, base)).toBeNull());
});
