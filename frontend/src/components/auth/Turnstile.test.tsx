import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';

vi.mock('./turnstileConfig', () => ({ TURNSTILE_SITE_KEY: 'test-site-key', turnstileEnabled: true, BOT_CHECK_CODES: ['BOT_CHECK_FAILED', 'BOT_CHECK_UNAVAILABLE'] }));

import { Turnstile } from './Turnstile';
import { useBotCheck } from './useBotCheck';

function Form() {
    const bot = useBotCheck();
    return <><Turnstile check={bot} /><button type="submit" disabled={!bot.ready}>Create account</button></>;
}
const script = () => document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]');

describe('the bot check', () => {
    it('says when it cannot load, and Retry loads it again', async () => {
        render(<Form />);
        expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
        await act(async () => { script()!.dispatchEvent(new Event('error')); });
        expect(await screen.findByRole('alert')).toHaveTextContent('The check could not be reached. Try again in a minute.');
        expect(script()).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(screen.queryByRole('alert')).toBeNull();
        expect(script()).not.toBeNull();
    });
});
