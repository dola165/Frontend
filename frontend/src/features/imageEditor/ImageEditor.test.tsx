import '../../i18n';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { EditImageButton } from './EditImageButton';
import { EditedImageNote } from './EditedImageNote';
import { handOffChatDraft, takeChatDraft, useChatDraft } from './chatDraft';
import { addPicture, type EditorState } from './editorState';
import { tooBig } from './editorImages';
import { editedAgo } from './imageEditorWords';

vi.mock('./api', () => ({ saveCopy: vi.fn(), editsOf: vi.fn() }));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source }));
// The real editor draws on canvases jsdom does not have; this stands in for it, and records when it is loaded.
const loaded = vi.hoisted(() => ({ editor: false }));
vi.mock('./editorLoader', () => ({
    loadEditor: () => {
        loaded.editor = true;
        return Promise.resolve({ default: ({ media, onSaved, onClose }: { media: { url: string }; onSaved: (saved: api.SavedCopy, image: File) => void; onClose: () => void }) =>
            <div role="dialog" aria-label="Edit picture">
                <button type="button" onClick={() => { onSaved(copyOf(media.url), new File(['x'], 'copy.png', { type: 'image/png' })); onClose(); }}>Save as new</button>
            </div> });
    },
}));

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const copyOf = (original: string): api.SavedCopy => ({ url: '/uploads/copy-1.jpg', thumbUrl: null, originalUrl: original, place: 'TEAM_WORK', itemId: 4, chatId: null, replyToId: null, attachment: null,
    editedBy: { id: 1, name: 'Beqa' }, editedAt: minutesAgo(2) });

beforeEach(() => {
    vi.mocked(api.editsOf).mockReset();
    vi.mocked(api.editsOf).mockResolvedValue([]);
});

it('loads the editor only when someone opens it, and the saved copy says at once who edited it', async () => {
    const onSaved = vi.fn();
    const { rerender } = render(<EditImageButton media={{ url: '/uploads/original-1.jpg', name: 'roster.png' }} onSaved={onSaved} />);
    expect(loaded.editor).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save as new' }));
    expect(loaded.editor).toBe(true);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ url: '/uploads/copy-1.jpg', originalUrl: '/uploads/original-1.jpg' }), expect.any(File));
    expect(screen.queryByRole('dialog', { name: 'Edit picture' })).not.toBeInTheDocument();

    rerender(<EditedImageNote url="/uploads/copy-1.jpg" />);
    expect(screen.getByText('Edited by Beqa · 2 min ago')).toBeInTheDocument();
    expect(api.editsOf).not.toHaveBeenCalled();
});

it('asks once for every picture on screen, notes only the edited copies, and opens the original', async () => {
    vi.mocked(api.editsOf).mockResolvedValue([
        { url: '/uploads/b.jpg', originalUrl: '/uploads/a.jpg', originalAvailable: true, place: 'CHAT', editedBy: { id: 2, name: 'Gio' }, editedAt: minutesAgo(5) },
        { url: '/uploads/c.jpg', originalUrl: '/uploads/gone.jpg', originalAvailable: false, place: 'TEAM_WORK', editedBy: { id: 3, name: 'Ilo' }, editedAt: minutesAgo(90) },
    ]);
    render(<>{['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'].map(url => <EditedImageNote key={url} url={url} />)}</>);
    expect(await screen.findByText('Edited by Gio · 5 min ago')).toBeInTheDocument();
    expect(api.editsOf).toHaveBeenCalledTimes(1);
    expect(api.editsOf).toHaveBeenCalledWith(['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']);
    expect(screen.getByText('Edited by Ilo · 2 h ago')).toBeInTheDocument();
    expect(screen.getByText('original removed')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Original' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Original' }));
    const viewer = await screen.findByRole('dialog', { name: 'Original picture' });
    expect(viewer.querySelector('img')).toHaveAttribute('src', '/uploads/a.jpg');
});

it('lets the place open the original its own way', async () => {
    vi.mocked(api.editsOf).mockResolvedValue([
        { url: '/uploads/e.jpg', originalUrl: '/uploads/d.jpg', originalAvailable: true, place: 'CHAT', editedBy: { id: 2, name: 'Gio' }, editedAt: minutesAgo(0) },
    ]);
    const open = vi.fn();
    render(<EditedImageNote url="/uploads/e.jpg" onOpenOriginal={open} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Original' }));
    expect(open).toHaveBeenCalledWith('/uploads/d.jpg');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('asks again later when the question failed', async () => {
    vi.mocked(api.editsOf).mockRejectedValueOnce(new Error('offline'));
    const { unmount } = render(<EditedImageNote url="/uploads/f.jpg" />);
    await waitFor(() => expect(api.editsOf).toHaveBeenCalledTimes(1));
    unmount();
    render(<EditedImageNote url="/uploads/f.jpg" />);
    await waitFor(() => expect(api.editsOf).toHaveBeenCalledTimes(2));
});

it('puts a pasted picture in the middle of what is shown, at most 70% of it, as one undoable change', () => {
    const state: EditorState = {
        annotationIds: ['Arrow-1'], annotations: {}, selectionsIds: [], originalSource: { width: 1000, height: 800 },
        shownImageDimensions: { originalSourceInitialScale: 0.5 }, adjustments: { crop: { x: 100, y: 50, width: 300, height: 200 } },
    };
    const picture = { naturalWidth: 1000, naturalHeight: 500 } as HTMLImageElement;
    const change = addPicture(state, picture);
    const [id] = change.selectionsIds ?? [];
    expect(change.isDesignState).toBe(true);
    expect(change.annotationIds).toEqual(['Arrow-1', id]);
    // The crop is 600×400 of the picture, from (200, 100): the pasted one is 420×210, centred in it.
    expect(change.annotations?.[id]).toMatchObject({ name: 'Image', image: picture, width: 420, height: 210, x: 290, y: 195 });
});

it('knows the server’s limits and says how long ago in the person’s words', () => {
    expect(tooBig(8192, 1953)).toBe(false);
    expect(tooBig(8193, 10)).toBe(true);
    expect(tooBig(4001, 4000)).toBe(true);
    const copy = (english: string) => english;
    const now = new Date('2026-10-25T12:00:00Z');
    expect(editedAgo(copy, '2026-10-25T11:59:40Z', now)).toBe('just now');
    expect(editedAgo(copy, '2026-10-25T11:58:00Z', now)).toBe('2 min ago');
    expect(editedAgo(copy, '2026-10-25T09:00:00Z', now)).toBe('3 h ago');
    expect(editedAgo(copy, '2026-10-24T11:00:00Z', now)).toBe('yesterday');
    expect(editedAgo(copy, '2026-10-21T12:00:00Z', now)).toBe('4 days ago');
});

it('hands a copy saved in a chat to that chat’s message box once, and a Team work copy to none', () => {
    const file = new File(['x'], 'pitch-edited.png', { type: 'image/png' });
    const attachment = { id: 31, kind: 'IMAGE' as const, name: 'pitch-edited.jpg', contentType: 'image/jpeg', sizeBytes: 900, url: '/uploads/copy-2.jpg', thumbUrl: null,
        width: 640, height: 480, playUrl: null, kept: false };
    expect(handOffChatDraft(copyOf('/uploads/original-2.jpg'), file)).toBe(false);
    const Box = ({ chatId }: { chatId: number }) => { const draft = useChatDraft(chatId); return <output aria-label={`chat ${chatId}`}>{draft ? `${draft.attachment.id} replying to ${draft.replyToId}` : 'empty'}</output>; };
    render(<><Box chatId={7} /><Box chatId={8} /></>);
    let handed = false;
    act(() => { handed = handOffChatDraft({ ...copyOf('/uploads/original-2.jpg'), place: 'CHAT', itemId: null, chatId: 7, replyToId: 120, attachment }, file); });
    expect(handed).toBe(true);
    expect(screen.getByLabelText('chat 7')).toHaveTextContent('31 replying to 120');
    expect(screen.getByLabelText('chat 8')).toHaveTextContent('empty');
    expect(takeChatDraft(8)).toBeNull();
    let taken: ReturnType<typeof takeChatDraft> = null;
    act(() => { taken = takeChatDraft(7); });
    expect(taken).toMatchObject({ chatId: 7, replyToId: 120, file });
    expect(screen.getByLabelText('chat 7')).toHaveTextContent('empty');
    expect(takeChatDraft(7)).toBeNull();
});
