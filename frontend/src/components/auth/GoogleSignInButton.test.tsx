import { render, screen } from '@testing-library/react';
import { GoogleSignInButton } from './GoogleSignInButton';

vi.mock('@react-oauth/google', () => ({ GoogleLogin: ({ width }: { width: number }) => <output>{typeof width}:{width}</output> }));

afterEach(() => { vi.restoreAllMocks(); });

it.each([[600, 'number:400'], [320, 'number:320'], [0, 'number:200']])('gives Google a pixel width for a %ipx column', (column, drawn) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(column);
    render(<GoogleSignInButton onSuccess={() => undefined} onError={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent(drawn);
});
