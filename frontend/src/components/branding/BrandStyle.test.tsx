import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { AuthUser } from '../../context/AuthContext';
import { AccountItems } from '../layout/header/AccountMenu';
import { BrandMark } from '../layout/BrandMark';
import { BrandWordmark } from '../layout/BrandWordmark';
import { BrandStyleProvider } from './BrandStyleProvider';
import { BRAND_STYLE_KEY, readBrandStyle } from './BrandStyleContext';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en', options: { resources: { en: {} } } } }) }));
vi.mock('../../features/squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => (english: string) => english }));
const appearance = vi.fn();
const show = () => render(<BrandStyleProvider><MemoryRouter><AccountItems user={{ id: 1, fullName: 'Test Coach' } as AuthUser}
    workspaces={[]} themePreference="map-light" setThemePreference={appearance} onLogout={vi.fn()} close={vi.fn()} menu profile={false} createPage={false} />
    <BrandWordmark /><BrandMark variant="store" /><BrandMark variant="map" /><BrandMark variant="jobs" /><BrandMark variant="campaigns" />
    <input aria-label="Unsent draft" defaultValue="" />
</MemoryRouter></BrandStyleProvider>);
beforeEach(() => { localStorage.removeItem(BRAND_STYLE_KEY); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.removeItem(BRAND_STYLE_KEY); document.documentElement.classList.remove('dark'); });

describe('independent brand styles', () => {
    it('keeps Pitch as default and switches all marks without changing appearance or a draft', () => {
        document.documentElement.classList.add('dark');
        const view = show();
        expect(screen.getByRole('menuitemradio', { name: 'Pitch' })).toHaveAttribute('aria-checked', 'true');
        expect(view.container.querySelector('.home-brand-wordmark')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Unsent draft'), { target: { value: 'Keep this question' } });
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'G Mark' }));
        expect(document.documentElement).toHaveAttribute('data-brand-style', 'g');
        expect(view.container.querySelectorAll('.g-brand-mark')).toHaveLength(4);
        expect(view.container.querySelector('.g-brand-wordmark')).toHaveTextContent('Grasskickz');
        expect(screen.getByLabelText('Unsent draft')).toHaveValue('Keep this question');
        expect(document.documentElement).toHaveClass('dark');
        expect(appearance).not.toHaveBeenCalled();
        expect(localStorage.getItem(BRAND_STYLE_KEY)).toBe('g');
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Pitch' }));
        expect(view.container.querySelectorAll('.g-brand-mark')).toHaveLength(0);
        expect(view.container.querySelector('.home-brand-wordmark')).toBeInTheDocument();
    });
    it('restores the saved style and follows changes from another tab', () => {
        localStorage.setItem(BRAND_STYLE_KEY, 'g');
        show();
        expect(screen.getByRole('menuitemradio', { name: 'G Mark' })).toHaveAttribute('aria-checked', 'true');
        act(() => { localStorage.setItem(BRAND_STYLE_KEY, 'pitch'); window.dispatchEvent(new StorageEvent('storage', { key: BRAND_STYLE_KEY, newValue: 'pitch' })); });
        expect(screen.getByRole('menuitemradio', { name: 'Pitch' })).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement).toHaveAttribute('data-brand-style', 'pitch');
    });
    it('falls back on invalid preferences and still switches when saving is blocked', () => {
        localStorage.setItem(BRAND_STYLE_KEY, 'unknown');
        expect(readBrandStyle()).toBe('pitch');
        show();
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'G Mark' }));
        expect(document.documentElement).toHaveAttribute('data-brand-style', 'g');
    });
});
