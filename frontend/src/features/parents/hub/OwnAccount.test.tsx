import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import type { JoiningChild } from '../api';

const api = vi.hoisted(() => ({ giveOwnAccount: vi.fn() }));
vi.mock('../api', () => api);

import { OwnAccount } from './OwnAccount';

const year = new Date().getFullYear();
const child = (dob: string, ownAccount?: JoiningChild['ownAccount']) => ({ playerId: 31, identity: { playerId: 31, version: 1, fullName: 'Luka Beridze', dateOfBirth: dob, gender: null, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true },
    clubs: [], cases: [], inquiries: [], ...(ownAccount ? { ownAccount } : {}) }) as JoiningChild;

beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en'); });

it('gives a child of 13 or more their own account: their email, then where the link went', async () => {
    api.giveOwnAccount.mockResolvedValue({ status: 'INVITED' });
    const changed = vi.fn();
    render(<OwnAccount child={child(`${year - 14}-02-01`)} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: /Give Luka their own account/ }));
    fireEvent.change(screen.getByLabelText('Luka’s email'), { target: { value: 'Luka@Example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(await screen.findByText('Link sent to luka@example.test')).toBeInTheDocument();
    expect(api.giveOwnAccount).toHaveBeenCalledWith(31, 'luka@example.test');
    expect(changed).toHaveBeenCalled();
});

it('offers nothing under 13, and says so once the child signs in on their own', () => {
    const { container, unmount } = render(<OwnAccount child={child(`${year - 10}-02-01`)} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    render(<OwnAccount child={child(`${year - 15}-02-01`, { status: 'ACTIVE' })} onChanged={vi.fn()} />);
    expect(screen.getByText('Luka signs in with their own account.')).toBeInTheDocument();
});
