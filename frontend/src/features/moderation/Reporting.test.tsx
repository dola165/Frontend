import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportControl } from './Reporting';
import { ReportReceipts } from './ReportReceipts';
import { ModerationPanel } from './ModerationPanel';
import { safeNotificationLink } from '../../utils/notificationDestinations';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));
beforeEach(() => { vi.clearAllMocks(); HTMLDialogElement.prototype.showModal = function () { this.open = true; }; api.get.mockResolvedValue({ data: { blocked: false } }); });
const mount = (view: React.ReactNode, url = '/') => render(<MemoryRouter initialEntries={[url]}>{view}</MemoryRouter>);
const receipt = { id: 12, targetType: 'MESSAGE', reason: 'SAFETY', status: 'OPEN', outcome: null, createdAt: '2026-09-26T10:00:00Z', resolvedAt: null };
describe('private reporting', () => {
    it('keeps reporting separate from blocking and opens the existing duplicate receipt', async () => {
        api.post.mockResolvedValue({ data: receipt }); mount(<ReportControl targetType="MESSAGE" targetId={44} conversationId={8} personId={9} />);
        fireEvent.click(screen.getByRole('button', { name: 'Report message' })); fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
        expect(await screen.findByRole('link', { name: 'Open private receipt' })).toHaveAttribute('href', '/reports?itemId=12');
        expect(api.put).not.toHaveBeenCalled(); expect(api.post).toHaveBeenCalledWith('/reports', expect.objectContaining({ targetId: 44, conversationId: 8 }));
        expect(screen.getByText(/already reported this item/)).toBeInTheDocument();
    });
    it('offers a safe retry when sending fails', async () => {
        api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: receipt }); mount(<ReportControl targetType="ACCOUNT" targetId={9} personId={9} />);
        fireEvent.click(screen.getByRole('button', { name: 'Report or block account' })); fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Retry report' })); expect(await screen.findByRole('link', { name: 'Open private receipt' })).toBeVisible();
    });
    it('sends an explicit desired personal block state', async () => {
        api.put.mockResolvedValue({ data: { blocked: true } }); mount(<ReportControl targetType="ACCOUNT" targetId={9} personId={9} />);
        fireEvent.click(screen.getByRole('button', { name: 'Report or block account' })); await screen.findByText('This person is not blocked by you.');
        fireEvent.click(screen.getByRole('button', { name: 'Block person' })); await screen.findByText('This person is blocked by you.');
        expect(api.put).toHaveBeenCalledWith('/users/9/personal-block', { blocked: true }); expect(api.post).not.toHaveBeenCalled();
    });
    it('does not expose evidence when a private receipt is denied', async () => {
        api.get.mockRejectedValue(new Error('denied')); mount(<ReportReceipts />, '/reports?itemId=99');
        expect(await screen.findByRole('alert')).toHaveTextContent(/another account/); expect(screen.queryByText(/Report #99/)).not.toBeInTheDocument();
    });
    it('shows an outcome without the removed message or reviewer note', async () => {
        api.get.mockResolvedValue({ data: { ...receipt, status: 'RESOLVED', outcome: 'REMOVE_MESSAGE' } }); mount(<ReportReceipts />, '/reports?itemId=12');
        expect(await screen.findByText('Message removed')).toBeVisible(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
    it('requires a deliberate confirmation and sends the reviewed version', async () => {
        const detail = { ...receipt, version: 4, evidence: 'Reported text', description: 'Incident', evidenceExpiresAt: '2026-12-25', targetState: 'AVAILABLE', actions: ['REMOVE_MESSAGE'], history: [] };
        api.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/12') ? detail : [detail] })); api.put.mockResolvedValue({ data: null });
        mount(<ModerationPanel />); fireEvent.click(await screen.findByRole('button', { name: 'Review report #12' })); await screen.findByText('Reported text');
        fireEvent.change(screen.getByLabelText('Review action'), { target: { value: 'REMOVE_MESSAGE' } }); fireEvent.change(screen.getByLabelText('Internal reason'), { target: { value: 'Reviewed harassment in the supplied message.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Review decision' })); expect(api.put).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' })); await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/moderation-reports/12', expect.objectContaining({ expectedVersion: 4, action: 'REMOVE_MESSAGE' })));
    });
});
describe('safe moderation receipt links', () => {
    it.each(['/reports', '/reports?itemId=12', '/reports?view=notices'])('allows canonical %s', path => expect(safeNotificationLink(path)?.pathname).toBe('/reports'));
    it.each(['/reports?itemId=0', '/reports?itemId=1&view=notices', '/reports?view=private', '/reports?itemId=1&itemId=2', '/reports#evidence', '//evil.test/reports', '/reports?itemId=9007199254740992'])('rejects malformed %s', path => expect(safeNotificationLink(path)).toBeNull());
});
