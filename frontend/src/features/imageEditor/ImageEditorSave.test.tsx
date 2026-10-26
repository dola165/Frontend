import '../../i18n';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { EditorImages } from './editorImages';
import * as flatten from './flatten';
import ImageEditor, { type BlurRequest } from './ImageEditor';

/**
 * The real wrapper around a stand-in for the editing library (which needs a real canvas): what the library would hand
 * back is set up here, and the wrapper's own work (saving, refusing, asking before discarding, blurring through
 * every layer) is what is tested.
 */
const library = vi.hoisted(() => ({ canvasWidth: 1200, update: null as null | ((state: Record<string, unknown>) => Record<string, unknown> | undefined) }));
vi.mock('react-filerobot-image-editor', async () => {
    const { useEffect } = await import('react');
    const TABS = { ADJUST: 'Adjust', ANNOTATE: 'Annotate', AI: 'AI' };
    const TOOLS = { CROP: 'Crop', ROTATE: 'Rotate', FLIP_X: 'Flip_X', FLIP_Y: 'Flip_Y', PEN: 'Pen', ARROW: 'Arrow', RECT: 'Rect', TEXT: 'Text', OBJECT_REMOVAL: 'ObjectRemoval' };
    const Stub = (props: { getCurrentImgDataFnRef: { current: unknown }; updateStateFnRef: { current: unknown }; onModify: (state: object) => void; ObjectRemoval: { onSubmitDraw: (request: BlurRequest) => void } }) => {
        const { getCurrentImgDataFnRef: imageRef, updateStateFnRef: stateRef } = props;
        useEffect(() => {
            imageRef.current = () => {
                const imageCanvas = document.createElement('canvas');
                imageCanvas.width = library.canvasWidth; imageCanvas.height = 796;
                return { imageData: { imageCanvas }, hideLoadingSpinner: () => undefined };
            };
            stateRef.current = (change: (state: Record<string, unknown>) => Record<string, unknown>) => { library.update = change; };
        });
        return <div data-stub-stage="">
            <button type="button" onClick={() => props.onModify({})}>Draw something</button>
            <button type="button" onClick={() => props.ObjectRemoval.onSubmitDraw({
                getMaskedImage: () => document.createElement('canvas'),
                originalSource: { naturalWidth: 1200, naturalHeight: 796 } as HTMLImageElement,
                objectPathsAttrs: [{ points: [100, 100, 300, 100], strokeWidth: 40 }],
                appStore: { designLayer: { findOne: () => undefined }, annotationIds: ['Arrow-1', 'Image-2'] },
            } satisfies BlurRequest)}>Blur it</button>
        </div>;
    };
    return { default: Stub, TABS, TOOLS };
});
vi.mock('./api', () => ({ saveCopy: vi.fn(), editsOf: vi.fn() }));
vi.mock('./flatten', () => ({ flattenUnder: vi.fn() }));
// The library's stage, holding its photo once the stand-in is on screen.
vi.mock('konva', () => ({ default: { Image: class {}, stages: [{ container: () => document.querySelector('[data-stub-stage]') ?? document.createElement('div'), content: document.createElement('div'), findOne: () => ({}) }] } }));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: () => 'blob:original' }));

const saved: api.SavedCopy = { url: '/uploads/copy.jpg', thumbUrl: null, originalUrl: '/uploads/roster.jpg', place: 'CHAT', itemId: null, chatId: 5, replyToId: 12, attachment: null,
    editedBy: { id: 1, name: 'Beqa' }, editedAt: new Date().toISOString() };
const blurred = { src: 'blob:blurred' } as HTMLImageElement;

beforeEach(() => {
    library.canvasWidth = 1200;
    library.update = null;
    vi.mocked(api.saveCopy).mockReset().mockResolvedValue(saved);
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })));
    URL.createObjectURL = vi.fn(() => 'blob:working');
    URL.revokeObjectURL = vi.fn();
    // jsdom does not decode pictures.
    HTMLImageElement.prototype.decode = () => Promise.resolve();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done: BlobCallback, type?: string) => done(new Blob(['jpeg'], { type: type ?? 'image/png' })));
    vi.spyOn(EditorImages.prototype, 'blur').mockResolvedValue(blurred);
    vi.mocked(flatten.flattenUnder).mockReset().mockReturnValue({ canvas: document.createElement('canvas'), baked: ['Arrow-1'] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const open = async (onSaved = vi.fn(), onClose = vi.fn()) => {
    render(<ImageEditor media={{ url: '/uploads/roster.jpg', name: 'roster.jpg', place: { messageId: 12 } }} onSaved={onSaved} onClose={onClose} />);
    // The wrapper mounts the library once more a frame after the first (so its own words show); wait for that one.
    await waitFor(() => expect(document.querySelector('.ie-stage[data-shown]')).not.toBeNull());
    await screen.findByRole('button', { name: 'Draw something' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save as new' })).toBeEnabled());
    return { onSaved, onClose };
};

it('saves a JPEG where Edit was pressed, hands it back and closes', async () => {
    const { onSaved, onClose } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [original, image, name, place] = vi.mocked(api.saveCopy).mock.calls[0];
    expect([original, name, place]).toEqual(['/uploads/roster.jpg', 'roster-edited.jpg', { messageId: 12 }]);
    expect((image as Blob).type).toBe('image/jpeg');
    expect(onSaved).toHaveBeenCalledWith(saved, expect.objectContaining({ name: 'roster-edited.jpg', type: 'image/jpeg' }));
});

it('says plainly when the picture is too big to save, and saves nothing', async () => {
    library.canvasWidth = 9000;
    const { onClose } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('too big to save');
    expect(api.saveCopy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

it('shows the server’s reason when the save is refused, and keeps the work open', async () => {
    vi.mocked(api.saveCopy).mockRejectedValue({ response: { status: 409, data: { detail: 'This chat is in Recently deleted. Restore it first.' } } });
    const { onClose } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This chat is in Recently deleted. Restore it first.');
    expect(onClose).not.toHaveBeenCalled();
});

it('closes on Escape when nothing changed', async () => {
    const quiet = await open();
    await userEvent.keyboard('{Escape}');
    expect(quiet.onClose).toHaveBeenCalledTimes(1);
});

it('asks before discarding changes; Keep editing keeps them, Discard closes', async () => {
    const { onClose } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Draw something' }));
    await userEvent.keyboard('{Escape}');
    const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' });
    await userEvent.click(within(ask, 'Keep editing'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(within(await screen.findByRole('alertdialog'), 'Discard'));
    expect(onClose).toHaveBeenCalled();
});

it('blurs through every layer beneath the painted area in one undoable step, hiding the drawings it baked in', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Blur it' }));
    await waitFor(() => expect(library.update).not.toBeNull());
    const [source, , ids, box] = vi.mocked(flatten.flattenUnder).mock.calls[0];
    expect((source as HTMLImageElement).naturalWidth).toBe(1200);
    expect(ids).toEqual(['Arrow-1', 'Image-2']);
    expect(box).toEqual({ left: 80, top: 80, right: 320, bottom: 120 });
    let change: Record<string, unknown> | undefined;
    act(() => { change = library.update?.({}); });
    expect(change).toMatchObject({ isDesignState: true, originalSource: blurred, imgSrc: 'blob:blurred', annotations: { 'Arrow-1': { visible: false } }, selectionsIds: [] });
});

it('keeps a picture pasted while the editor opens, and puts it in once the editor is on screen', async () => {
    const added = { naturalWidth: 300, naturalHeight: 200, src: 'blob:added' } as HTMLImageElement;
    const fromAdded = vi.spyOn(EditorImages.prototype, 'fromAddedBlob').mockResolvedValue(added);
    render(<ImageEditor media={{ url: '/uploads/roster.jpg', name: 'roster.jpg' }} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector('.ie-stage[data-shown]')).toBeNull();
    const pasted = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasted, 'clipboardData', { value: { files: [new File(['p'], 'card.png', { type: 'image/png' })] } });
    document.body.dispatchEvent(pasted);
    expect(pasted.defaultPrevented).toBe(true);
    expect(fromAdded).not.toHaveBeenCalled();
    await waitFor(() => expect(library.update).not.toBeNull());
    expect(document.querySelector('.ie-stage[data-shown]')).not.toBeNull();
    expect(fromAdded).toHaveBeenCalledWith(expect.objectContaining({ name: 'card.png' }), expect.any(Number));
});

const within = (root: HTMLElement, name: string) => [...root.querySelectorAll('button')].find(button => button.textContent === name) as HTMLButtonElement;
