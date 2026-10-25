import '../../i18n';
import { useRef } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import * as chatApi from '../teamChat/api';
import { useChatUploads } from '../teamChat/useChatUploads';

vi.mock('../teamChat/api', async importOriginal => ({ ...await importOriginal<typeof chatApi>(), cancelUpload: vi.fn(), uploadPicture: vi.fn(), uploadVideo: vi.fn(), uploadFile: vi.fn() }));

const limits: chatApi.ChatLimits = { pictureMb: 10, videoMb: 90, fileMb: 25, videoTypes: ['video/mp4'], fileExtensions: ['pdf'], maxLength: 2000, maxAttachments: 2, maxDecision: 200 };
const copyOf = (id: number) => ({
    attachment: { id, kind: 'IMAGE' as const, name: `copy-${id}.jpg`, contentType: 'image/jpeg', sizeBytes: 900, url: `/uploads/copy-${id}.jpg`, thumbUrl: null, width: 64, height: 48, playUrl: null, kept: false },
    file: new File(['x'], `copy-${id}.jpg`, { type: 'image/jpeg' }),
});

beforeEach(() => {
    vi.mocked(chatApi.cancelUpload).mockReset().mockResolvedValue(undefined as never);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
});

it('takes edited copies as ready files, keeps the per-message limit, and cancels what does not fit', () => {
    const { result } = renderHook(() => useChatUploads(7, limits));
    let taken = 0;
    act(() => { taken = result.current.adopt([copyOf(1), copyOf(2), copyOf(3)]); });
    expect(taken).toBe(2);
    expect(result.current.items.map(item => [item.attachment?.id, item.state])).toEqual([[1, 'ready'], [2, 'ready']]);
    expect(result.current.ready).toBe(true);
    expect(chatApi.cancelUpload).toHaveBeenCalledWith(3);
    expect(result.current.refusal).toBe('At most 2 files in one message.');
    // The same copy twice goes in once.
    act(() => { result.current.adopt([copyOf(1)]); });
    expect(result.current.items).toHaveLength(2);
});

it('takes an edited copy back out like any upload: the server cancels it and its preview is let go', () => {
    const { result } = renderHook(() => useChatUploads(7, limits));
    act(() => { result.current.adopt([copyOf(5)]); });
    const id = result.current.items[0].id;
    act(() => { result.current.cancel(id); });
    expect(result.current.items).toEqual([]);
    expect(chatApi.cancelUpload).toHaveBeenCalledWith(5);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});

function Framed({ alsoInside }: { alsoInside?: string }) {
    const box = useRef<HTMLElement>(null);
    useDialogFocus(true, box, undefined, undefined, alsoInside);
    return <section ref={box} role="dialog" aria-label="Editor"><button type="button">Inside</button></section>;
}

// A library opens its pop-ups in <body> after the dialog is open (so they are never made inert with the page behind).
const openPopup = () => {
    const popup = document.createElement('div');
    popup.className = 'SfxModal-Wrapper';
    popup.innerHTML = '<input aria-label="Hex" />';
    document.body.appendChild(popup);
    return popup;
};

it('lets focus into pop-ups named as inside the dialog, and only those', () => {
    const first = render(<Framed alsoInside=".SfxModal-Wrapper" />);
    const popup = openPopup();
    const hex = popup.querySelector('input') as HTMLInputElement;
    act(() => { hex.focus(); });
    expect(document.activeElement).toBe(hex);
    first.unmount();
    popup.remove();

    render(<Framed />);
    const other = openPopup();
    act(() => { (other.querySelector('input') as HTMLInputElement).focus(); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inside' }));
    other.remove();
});
