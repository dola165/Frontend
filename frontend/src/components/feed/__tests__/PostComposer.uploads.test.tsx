import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PostComposer } from '../PostComposer';

const upload = vi.fn(() => HttpResponse.json({ id: 101 }));
const publish = vi.fn(() => HttpResponse.json({ id: 1 }));
const server = setupServer(http.post('*/media/upload', upload), http.post('*/posts', publish));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    vi.stubGlobal('URL', class extends URL {
        static createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
        static revokeObjectURL = vi.fn();
    });
});
afterEach(() => { cleanup(); server.resetHandlers(); vi.unstubAllGlobals(); });
function setup() {
    const created = vi.fn();
    render(<MemoryRouter><PostComposer compact onPostCreated={created} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /video/i })).toBeNull();
    const picker = screen.getByLabelText('Choose photo');
    expect(picker).toHaveAttribute('accept', 'image/jpeg,image/png,image/gif,image/webp');
    fireEvent.focus(screen.getByRole('textbox', { name: 'Create a post' }));
    expect(screen.queryByRole('button', { name: /video/i })).toBeNull();
    expect(screen.getByText(/Max 10 MB/)).toBeVisible();
    return { picker, created, button: screen.getByRole('button', { name: 'Publish post' }) };
}
const select = (picker: HTMLElement, file: File) => fireEvent.change(picker, { target: { files: [file] } });
const caption = () => fireEvent.change(screen.getByRole('textbox', { name: 'Create a post' }), { target: { value: 'Photo caption' } });

it.each(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])('accepts and publishes a supported %s image', async type => {
    const { picker, button, created } = setup();
    caption();
    select(picker, new File(['image bytes'], 'photo', { type }));
    expect(screen.getByAltText('Upload preview')).toBeVisible();
    fireEvent.click(button); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenCalledTimes(1);
});

it('accepts exactly 10 MiB without rounding the limit down', async () => {
    const { picker, button, created } = setup();
    caption();
    select(picker, new File([new Uint8Array(10 * 1024 * 1024)], 'boundary.png', { type: 'image/png' }));
    fireEvent.click(button); await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(1);
});

it.each([
    { type: 'video/mp4', size: 10, error: /Videos are not supported/ },
    { type: 'image/svg+xml', size: 10, error: /Choose a JPEG/ },
    { type: 'image/bmp', size: 10, error: /Choose a JPEG/ },
    { type: '', size: 10, error: /Choose a JPEG/ },
    { type: 'image/png', size: 0, error: /file is empty/ },
    { type: 'image/png', size: 10 * 1024 * 1024 + 1, error: /10 MB or smaller/ },
])('rejects $type / $size bytes before preview or network upload', ({ type, size, error }) => {
    const { picker, button } = setup();
    select(picker, new File([new Uint8Array(size)], 'rejected-file', { type }));
    expect(screen.getByRole('alert')).toHaveTextContent(error);
    expect(screen.queryByAltText('Upload preview')).toBeNull(); expect(button).toBeDisabled();
    expect(upload).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
});

it('keeps valid photos and text when an invalid addition is rejected', () => {
    const { picker, button } = setup();
    const text = screen.getByRole('textbox', { name: 'Create a post' });
    fireEvent.change(text, { target: { value: 'Keep my draft' } });
    select(picker, new File(['image'], 'original.png', { type: 'image/png' }));
    select(picker, new File(['video'], 'replacement.mp4', { type: 'video/mp4' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Videos are not supported/);
    expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:original.png');
    expect(text).toHaveValue('Keep my draft'); expect(button).toBeEnabled();
    select(picker, new File(['image'], 'corrected.png', { type: 'image/png' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByAltText('Upload preview 1: original.png')).toHaveAttribute('src', 'blob:original.png');
    expect(screen.getByAltText('Upload preview 2: corrected.png')).toHaveAttribute('src', 'blob:corrected.png');
});

it.each([
    { status: 400, error: 'File exceeds the 10MB upload limit.', expected: /10 MB or smaller/ },
    { status: 413, error: 'File exceeds the upload size limit.', expected: /10 MB or smaller/ },
    { status: 400, error: 'Unsupported image format.', expected: /JPEG, PNG, GIF or WebP/ },
    { status: 400, error: 'Invalid or damaged image.', expected: /Export it as JPEG/ },
    { status: 400, error: 'Images must be at most 8192 pixels per side and 16 megapixels.', expected: /Resize this photo/ },
    { status: 429, error: 'Image processing is busy. Try again shortly.', expected: /Wait a moment/ },
    { status: 503, error: 'Unavailable', expected: /Photo upload failed/ },
])('shows recovery for server $status / $error while retaining the draft', async ({ status, error, expected }) => {
    server.use(http.post('*/media/upload', () => HttpResponse.json({ error }, { status })));
    const { picker, button } = setup();
    caption();
    select(picker, new File(['image'], 'retained.png', { type: 'image/png' }));
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByAltText('Upload preview')).toHaveAttribute('src', 'blob:retained.png');
    expect(button).toBeEnabled(); expect(publish).not.toHaveBeenCalled();
});
