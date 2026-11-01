import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AddChild } from './AddChild';

const prefs = vi.hoisted(() => ({ start: {} as { childAge?: number | null } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 }, sessionId: 'family', refreshNavigationCapabilities: vi.fn() }) }));
vi.mock('../actions/useAction', () => ({ useAction: () => ({ allowed: true, loading: false, reason: null, needsBirthDate: false, askAdmin: false, href: null }) }));
vi.mock('../preferences/preferencesStore', () => ({ usePreferences: () => ({ start: prefs.start }) }));
vi.mock('../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));

const year = new Date().getFullYear();
const date = () => screen.getByLabelText(/Date of birth/) as HTMLInputElement;
beforeEach(() => { prefs.start = {}; sessionStorage.clear(); });
afterEach(cleanup);

it('asks the full birth date, opening it in the year the welcome was given, with another year one press away', () => {
    prefs.start = { childAge: 7 };
    render(<AddChild inline onCreated={vi.fn()} />);
    expect(date()).toHaveAttribute('min', `${year - 7}-01-01`);
    expect(date()).toHaveAttribute('max', `${year - 7}-12-31`);
    fireEvent.click(screen.getByRole('button', { name: 'Another year' }));
    expect(date()).not.toHaveAttribute('min');
    expect(date()).toHaveAttribute('max', new Date().toISOString().slice(0, 10));
    expect(screen.queryByRole('button', { name: 'Another year' })).not.toBeInTheDocument();
});

it('keeps the welcome’s own year as given there, and opens on any year without one', () => {
    prefs.start = { childAge: 7 };
    render(<AddChild inline birthYear={year - 9} onCreated={vi.fn()} />);
    expect(date()).toHaveAttribute('min', `${year - 9}-01-01`);
    expect(screen.queryByRole('button', { name: 'Another year' })).not.toBeInTheDocument();
    cleanup(); prefs.start = {};
    render(<AddChild inline onCreated={vi.fn()} />);
    expect(date()).not.toHaveAttribute('min');
    expect(screen.queryByRole('button', { name: 'Another year' })).not.toBeInTheDocument();
});
