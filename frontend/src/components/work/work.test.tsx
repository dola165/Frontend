import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MentionText } from './MentionInput';
import { PasteFrame } from './PasteFrame';
import type { WorkMedia } from './types';
import { WorkMediaList } from './WorkMedia';

vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (url: string) => url }));

describe('The planner’s shared parts', () => {
    it('shows a video it cannot play as a file to save, never as a picture', () => {
        const video: WorkMedia = { id: 1, kind: 'VIDEO', url: '/uploads/training.mp4', contentType: 'video/mp4', sizeBytes: 2_000_000, uploadedBy: null, createdAt: '2026-10-29T10:00:00Z', canDelete: false, name: 'training.mp4' };
        const { container } = render(<WorkMediaList media={[video]} actions={{ remove: vi.fn() }} onChanged={vi.fn()} />);
        expect(screen.getByRole('link', { name: /training\.mp4/ })).toHaveAttribute('download', 'training.mp4');
        expect(container.querySelector('img')).toBeNull();
    });

    it('marks a tag with the shared class, more when it is you', () => {
        const { container } = render(<MentionText text="Ask @Nana Beridze and @Luka" team={[{ id: 3, name: 'Nana Beridze' }, { id: 1, name: 'Luka' }]} me={1} />);
        const tags = container.querySelectorAll('.work-tag');
        expect(tags).toHaveLength(2);
        expect(container.querySelector('.work-tag[data-me]')).toHaveTextContent('@Luka');
    });

    it('shows the fresh answer when applying changed nothing, instead of doing nothing', async () => {
        const onApplied = vi.fn();
        const read = vi.fn(async (_text: string, apply: boolean) => ({ lines: apply ? 0 : 2, done: false }));
        render(<PasteFrame title="Paste a plan" description="One step a line." example="- Book the bus" read={read}
            preview={result => <p>{result.lines ? `${result.lines} steps` : 'Nothing to change'}</p>} changes={result => result.lines} applied={result => result.done}
            onClose={vi.fn()} onApplied={onApplied} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '- Book the bus\n- Pay' } });
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
        await waitFor(() => expect(screen.getByText('Nothing to change')).toBeInTheDocument());
        expect(onApplied).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });
});
