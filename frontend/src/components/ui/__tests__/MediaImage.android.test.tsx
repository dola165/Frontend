import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MediaImage } from '../MediaImage';
import { apiClient } from '../../../api/axiosConfig';

vi.mock('../../../android/bridge', () => ({ isAndroidApp: true }));
vi.mock('../../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn() },
    DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:3000/' },
}));

it('uses native authenticated image delivery instead of copying image bodies through the JavaScript bridge', () => {
    const view = render(<MediaImage src="/uploads/club-photo.jpg" alt="Club" />);
    expect(screen.getByAltText('Club')).toHaveAttribute('src', `${location.origin}/uploads/club-photo.jpg`);
    expect(screen.getByAltText('Club')).toHaveAttribute('decoding', 'async');
    expect(apiClient.get).not.toHaveBeenCalled();
    view.rerender(<MediaImage src="/uploads/next-photo.jpg" alt="Club" />);
    expect(screen.getByAltText('Club')).toHaveAttribute('src', `${location.origin}/uploads/next-photo.jpg`);
});

it('keeps third-party images outside the native authenticated media path', () => {
    render(<MediaImage src="https://example.test/uploads/public.jpg" alt="External" />);
    expect(screen.getByAltText('External')).toHaveAttribute('src', 'https://example.test/uploads/public.jpg');
    expect(apiClient.get).not.toHaveBeenCalled();
});
