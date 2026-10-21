import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { OlderMessages } from './OlderMessages';

afterEach(async () => { await i18n.changeLanguage('en'); });
it('translates the older-history error, loading and retry action without changing the request', async () => {
    await i18n.changeLanguage('ka');
    const load = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<OlderMessages available loading={false} error="Could not load older messages. Please try again." onLoad={load} />);
    expect(screen.getByRole('alert')).toHaveTextContent('ძველი შეტყობინებები ვერ ჩაიტვირთა.');
    fireEvent.click(screen.getByRole('button', { name: 'ძველი შეტყობინებების ჩატვირთვა' }));
    expect(load).toHaveBeenCalledTimes(1);
    rerender(<OlderMessages available loading error={null} onLoad={load} />);
    expect(screen.getByRole('button', { name: 'ძველი შეტყობინებები იტვირთება…' })).toBeDisabled();
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('button', { name: 'Loading older messages…' })).toBeDisabled();
});
