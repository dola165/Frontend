import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WhoIsInIt } from '../WhoIsInIt';
import { NOT_ANSWERED, photoAnswerBody, type PhotoAnswer } from '../photoAnswer';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));

const faces = [
    { id: 1, name: 'Teo Teen', squadId: 9, squadName: 'U14', yes: true },
    { id: 2, name: 'Nika Teen', squadId: 9, squadName: 'U14', yes: false },
];
function Host({ caption = '' }: { caption?: string }) {
    const [answer, setAnswer] = useState<PhotoAnswer>(NOT_ANSWERED);
    return <><WhoIsInIt clubId={3} squadId={9} answer={answer} onAnswer={setAnswer} caption={caption} /><span data-testid="body">{JSON.stringify(photoAnswerBody(answer))}</span></>;
}

describe('WhoIsInIt', () => {
    beforeEach(() => api.get.mockReset());

    it('says who will see the photo for each answer', async () => {
        api.get.mockResolvedValue({ data: { ask: true, clubId: 3, people: faces } });
        render(<Host />);
        expect(await screen.findByRole('status')).toHaveTextContent('Not answered: only the squad’s families and staff');
        expect(screen.getByTestId('body')).toHaveTextContent('{}');
        fireEvent.click(screen.getByRole('button', { name: /Teo/ }));
        expect(screen.getByRole('status')).toHaveTextContent('Every family said yes');
        expect(screen.getByTestId('body')).toHaveTextContent('{"photoChildren":"NAMED","photoPeople":[1]}');
        fireEvent.click(screen.getByRole('button', { name: /Nika/ }));
        expect(screen.getByRole('status')).toHaveTextContent('until 1 more family says yes');
        fireEvent.click(screen.getByRole('button', { name: 'No children in it' }));
        expect(screen.getByRole('status')).toHaveTextContent('followers can see');
        expect(screen.getByTestId('body')).toHaveTextContent('{"photoChildren":"NONE"}');
    });

    it('warns when the caption names a child in the photo', async () => {
        api.get.mockResolvedValue({ data: { ask: true, clubId: 3, people: faces } });
        render(<Host caption="Teo scored twice" />);
        fireEvent.click(await screen.findByRole('button', { name: /Teo/ }));
        expect(screen.getByText(/The caption names Teo/)).toBeVisible();
    });

    it('asks nothing for adult football', async () => {
        api.get.mockResolvedValue({ data: { ask: false, clubId: 3, people: [] } });
        const { container } = render(<Host />);
        await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
        expect(container.querySelector('.who-in-it')).toBeNull();
    });
});
