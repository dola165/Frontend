import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkspaceCapability } from '../context/navigationCapabilities';
import { getAuthSessionId, setStoredAccessToken } from '../utils/authStorage';
import CoachWorkspacePage from './CoachWorkspacePage';
import '../i18n';

const fixture = vi.hoisted(() => ({ authenticated: true, sessionId: null as string | null, workspaces: [] as WorkspaceCapability[], known: true, mounted: [] as number[] }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: fixture.authenticated, sessionId: fixture.sessionId, user: { id: 9500, navigationCapabilities: fixture.known ? { version: 1, workspaces: fixture.workspaces } : undefined } }) }));
vi.mock('../features/clubWorkspace/coachHub/CoachWorkspace', () => ({ CoachWorkspace: ({ clubId }: { clubId: number }) => {
    const [draft, setDraft] = useState(''); fixture.mounted.push(clubId);
    return <div><p data-testid="chosen-club">{clubId}</p><input aria-label="Scoped draft" value={draft} onChange={event => setDraft(event.target.value)} /></div>;
} }));
const cap = (id: number, label: string, kind = 'club.workspace'): WorkspaceCapability => ({ id: kind, context: { type: 'club', id, label } });
const mount = (query = '') => render(<MemoryRouter initialEntries={['/my-squads' + query]}><CoachWorkspacePage /></MemoryRouter>);
beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); setStoredAccessToken('scoped-page-fixture');
    fixture.sessionId = getAuthSessionId(); fixture.authenticated = true; fixture.known = true; fixture.mounted = [];
    fixture.workspaces = [cap(399, 'A other club'), cap(400, 'Z assigned club')];
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe('authorized club handoff destination', () => {
    it('uses the requested authorized club instead of the first alphabetical workspace', () => {
        mount('?clubId=400'); expect(screen.getByTestId('chosen-club')).toHaveTextContent(/^400$/);
        expect(fixture.mounted).not.toContain(399);
    });
    it('accepts current operations access without inventing a separate staff role', () => {
        fixture.workspaces = [cap(399, 'A other club'), cap(400, 'Z assigned club', 'club.operations')];
        mount('?clubId=400'); expect(screen.getByTestId('chosen-club')).toHaveTextContent(/^400$/);
    });
    it.each(['?clubId=', '?clubId=0', '?clubId=-1', '?clubId=0400', '?clubId=400.0', '?clubId=4e2', '?clubId=400%20', '?clubId=https://foreign.invalid', '?clubId=9007199254740992', '?clubId=400&clubId=400', '?clubId=399&clubId=400'])('refuses malformed or duplicate context without opening another club: %s', query => {
        mount(query); expect(screen.getByText('Club squads unavailable')).toBeVisible(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('refuses a positive foreign club instead of falling back to a permitted different club', () => {
        mount('?clubId=500'); expect(screen.getByText('Club squads unavailable')).toBeVisible(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('does not promote club membership to workspace access', () => {
        fixture.workspaces = [cap(399, 'A other club'), cap(400, 'Z assigned club', 'club.member')];
        mount('?clubId=400'); expect(screen.getByText('Club squads unavailable')).toBeVisible(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('lists a player’s or family’s own squads instead of saying there are none', () => {
        fixture.workspaces = [{ id: 'squad.workspace', context: { type: 'squad', id: 2, label: 'Dinamo Academy — U16 Boys' } }, cap(400, 'Z assigned club', 'club.player')];
        mount(); expect(screen.getByRole('link', { name: /Dinamo Academy — U16 Boys/ })).toHaveAttribute('href', '/squads/2');
        expect(screen.queryByText('No squads yet')).not.toBeInTheDocument(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('keeps unknown current access from becoming a club or coaching grant', () => {
        fixture.known = false; mount('?clubId=400'); expect(screen.getByText('Club squads unavailable')).toBeVisible(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('unmounts the selected club if its current access is withdrawn without selecting another', () => {
        const view = mount('?clubId=400'); expect(screen.getByTestId('chosen-club')).toHaveTextContent(/^400$/);
        fixture.mounted = []; fixture.workspaces = [cap(399, 'A other club')];
        view.rerender(<MemoryRouter><CoachWorkspacePage /></MemoryRouter>);
        expect(screen.getByText('Club squads unavailable')).toBeVisible(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('refuses a captured login that retired before destination rendering', () => {
        setStoredAccessToken('replacement-fixture-login'); mount('?clubId=400');
        expect(screen.getByText('Your sign-in changed')).toBeVisible(); expect(fixture.mounted).toStrictEqual([]);
    });
    it('starts a new same-actor login with a fresh selected-club workspace', () => {
        const view = mount('?clubId=400'); fireEvent.change(screen.getByRole('textbox', { name: 'Scoped draft' }), { target: { value: 'old private draft' } });
        setStoredAccessToken('new-same-actor-fixture-login'); fixture.sessionId = getAuthSessionId();
        view.rerender(<MemoryRouter><CoachWorkspacePage /></MemoryRouter>);
        expect(screen.getByRole('textbox', { name: 'Scoped draft' })).toHaveValue(''); expect(screen.getByTestId('chosen-club')).toHaveTextContent(/^400$/);
    });
    it('keeps an unauthenticated scoped destination from mounting a workspace', () => {
        fixture.authenticated = false; mount('?clubId=400'); expect(fixture.mounted).toStrictEqual([]);
    });
    it('retains the existing first-authorized-club choice for an unscoped legacy entry', () => {
        mount(); expect(screen.getByTestId('chosen-club')).toHaveTextContent(/^399$/);
    });
});
