import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WaitingForFamily } from './WaitingForFamily';
import { fetchWaitingCards } from '../../clubs/api';
import { clubCardFamilyLink } from '../../parents/familyLinks';
import type { CoachData } from './CoachWorkspace';

vi.mock('../../clubs/api', () => ({ fetchWaitingCards: vi.fn() }));
vi.mock('../../parents/familyLinks', () => ({ clubCardFamilyLink: vi.fn() }));
vi.mock('../../parents/FamilyLinkShare', () => ({
    FamilyLinkShare: ({ load, label }: { load: () => Promise<unknown>; label: string }) => <button type="button" onClick={() => void load()}>{label}</button>,
}));

const data = { clubId: 70, shown: [23], revision: 0, names: new Map([[23, '2015 Boys']]) } as unknown as CoachData;

describe('WaitingForFamily', () => {
    it('lists the squad’s waiting cards and sends the same card’s link again', async () => {
        vi.mocked(fetchWaitingCards).mockResolvedValue([{ cardId: 2, userId: 263, fullName: 'Saba Kapanadze', birthYear: 2015 }]);
        render(<WaitingForFamily data={data} />);
        expect(await screen.findByText('Saba Kapanadze')).toBeInTheDocument();
        expect(fetchWaitingCards).toHaveBeenCalledWith(70, 23);
        fireEvent.click(screen.getByRole('button', { name: 'Send again' }));
        expect(screen.getByText('Saba joins 2015 Boys when the family opens this link and says yes.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Link for Saba’s family' }));
        expect(clubCardFamilyLink).toHaveBeenCalledWith(70, 263);
    });

    it('shows nothing when no card waits', async () => {
        vi.mocked(fetchWaitingCards).mockResolvedValue([]);
        const { container } = render(<WaitingForFamily data={data} />);
        await Promise.resolve();
        expect(container).toBeEmptyDOMElement();
    });
});
