import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useFileDrop } from '../../components/work/useFileDrop';
import * as api from './api';
import type { PlanView, WorkMedia } from './api';
import { PlanMedia } from './PlanMedia';
import { usePlanUploads } from './useUploads';

vi.mock('./api', async importOriginal => ({
    ...await importOriginal<typeof api>(), addPlanPicture: vi.fn(), addPlanVideo: vi.fn(), addPlanFile: vi.fn(), deletePlanMedia: vi.fn(), planPlayLink: vi.fn(),
}));
vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source && 'blob:the-file' }));

const view = { plan: { id: 7 } } as unknown as PlanView;
const file = (id: number, name: string, extra: Partial<WorkMedia> = {}): WorkMedia => ({
    id, kind: 'FILE', url: `/uploads/team-work/${id}`, contentType: 'application/x', sizeBytes: 2048, uploadedBy: { id: 1, name: 'Beqa' }, createdAt: new Date().toISOString(), canDelete: true, name, ...extra,
} as WorkMedia);

function Page({ media, onChanged }: { media: WorkMedia[]; onChanged: (next: PlanView) => void }) {
    const uploads = usePlanUploads(7, onChanged);
    const drop = useFileDrop(files => void uploads.upload(files));
    return <div data-testid="page" {...drop.bind}><PlanMedia planId={7} media={media} uploads={uploads} onChanged={onChanged} /></div>;
}
const show = (media: WorkMedia[] = []) => {
    const onChanged = vi.fn();
    const { container } = render(<Page media={media} onChanged={onChanged} />);
    return { onChanged, input: container.querySelector('input[type="file"]') as HTMLInputElement };
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.addPlanPicture).mockResolvedValue(view);
    vi.mocked(api.addPlanVideo).mockResolvedValue(view);
    vi.mocked(api.addPlanFile).mockResolvedValue(view);
    vi.mocked(api.deletePlanMedia).mockResolvedValue(view);
});

it('sends each kind of file its own way and hands back the plan', async () => {
    const { onChanged, input } = show();
    const deck = new File(['deck'], 'Layer 1.pptx');
    const picture = new File(['p'], 'pitch.png', { type: 'image/png' });
    const video = new File(['v'], 'session.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [deck, picture, video] } });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(3));
    expect(api.addPlanFile).toHaveBeenCalledWith(7, deck, expect.any(Function));
    expect(api.addPlanPicture).toHaveBeenCalledWith(7, picture);
    expect(api.addPlanVideo).toHaveBeenCalledWith(7, video, expect.any(Function));
});

it('takes a file dropped anywhere on the page', async () => {
    const { onChanged } = show();
    const deck = new File(['deck'], 'Layer 1.pptx');
    fireEvent.drop(screen.getByTestId('page'), { dataTransfer: { files: [deck], types: ['Files'] } });
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(view));
    expect(api.addPlanFile).toHaveBeenCalledWith(7, deck, expect.any(Function));
});

it('says why a kind of file is refused and sends nothing', async () => {
    const { input } = show();
    fireEvent.change(input, { target: { files: [new File(['x'], 'program.exe')] } });
    expect((await screen.findByRole('alert')).textContent).toContain('program.exe');
    expect(api.addPlanFile).not.toHaveBeenCalled();
});

it('shows what is on the plan and removes it from this plan', async () => {
    const { onChanged } = show([file(3, 'Layer 1.pptx')]);
    expect(screen.getByText('Layer 1.pptx')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Remove Layer 1\.pptx/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(view));
    expect(api.deletePlanMedia).toHaveBeenCalledWith(7, 3);
});

it('offers no remove on a file someone else added', () => {
    show([file(3, 'Layer 1.pptx', { canDelete: false })]);
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
});
