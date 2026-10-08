import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { JevAdvice } from './JevAdvice';
import { ReportPost } from './ReportPost';
import { ContentReportsPanel } from './ContentReportsPanel';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
const advice = { outcome: 'classified', suggestions: { kind: 'QUALIFICATION' } };
it('never calls Jev on mount or typing, checks once explicitly, and only applies on confirmation', async () => {
    const apply = vi.fn(); vi.mocked(apiClient.post).mockResolvedValue({ data: advice });
    const { rerender } = render(<JevAdvice endpoint="/jev/career" input={{ title: 'Coach', description: '' }} kind="career" onApply={apply} />);
    rerender(<JevAdvice endpoint="/jev/career" input={{ title: 'Coaching diploma', description: 'A course' }} kind="career" onApply={apply} />);
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest entry type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Checking…' }));
    await screen.findByRole('button', { name: 'Use suggestion' });
    expect(apiClient.post).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Suggest entry type' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use suggestion' })); expect(apply).toHaveBeenCalledWith('QUALIFICATION');
    expect(apiClient.put).not.toHaveBeenCalled();
});
it('discards a response for text that changed while the request was running', async () => {
    let complete!: (value: {data: typeof advice}) => void;
    vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const { rerender } = render(<JevAdvice endpoint="/jev/career" input={{ title: 'Course' }} kind="career" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest entry type' }));
    rerender(<JevAdvice endpoint="/jev/career" input={{ title: 'Position' }} kind="career" />);
    await act(async () => complete({ data: advice }));
    expect(screen.queryByText(/Suggested category/)).not.toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
});
it('retires suggestions when the authenticated session changes', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: advice });
    render(<JevAdvice endpoint="/jev/career" input={{ title: 'Course' }} kind="career" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest entry type' })); await screen.findByText(/Suggested category/);
    act(() => { localStorage.setItem('gk-session-id','another-account'); window.dispatchEvent(new Event('gk-auth-changed')); });
    expect(screen.queryByText(/Suggested category/)).not.toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
});
it('allows checking restored text after aborting its previous request without an old response clearing a new check', async () => {
    const completions: Array<(value: { data: typeof advice }) => void> = [];
    vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => completions.push(resolve)));
    const view = (title: string) => <JevAdvice endpoint="/jev/career" input={{ title }} kind="career" />;
    const { rerender } = render(view('Course'));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest entry type' }));
    const firstSignal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
    rerender(view('Position'));
    expect(firstSignal?.aborted).toBe(true);
    rerender(view('Course'));
    expect(screen.getByRole('button', { name: 'Suggest entry type' })).toBeEnabled();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest entry type' }));
    await act(async () => completions[0]({ data: advice }));
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    expect(screen.queryByText(/Suggested category/)).not.toBeInTheDocument();
    await act(async () => completions[1]({ data: advice }));
    expect(screen.getByText(/Suggested category/)).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(2);
});
it.each(['budget','daily_limit','unavailable','uncertain','disabled'])('keeps manual editing available for %s without retries', async outcome => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { outcome, suggestions: {} } });
    render(<JevAdvice endpoint="/jev/career" input={{ title: 'Course' }} kind="career" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest entry type' }));
    await screen.findByText(/continue manually/); expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Use suggestion' })).not.toBeInTheDocument();
});
it('reports a post only after submission and never invokes triage from the feed', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({}); render(<ReportPost postId={10} />);
    expect(apiClient.post).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Report post' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }),{target:{value:'SPAM'}});
    expect(apiClient.post).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    await screen.findByText('Report submitted for administrator review.');
    expect(apiClient.post).toHaveBeenCalledWith('/posts/10/reports',{reason:'SPAM'},expect.anything());
    expect(apiClient.post).toHaveBeenCalledTimes(1);
});
it('loads the review queue without calling Jev and resolves only on administrator action', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({data:[{id:4,postId:10,content:'Reported text',reason:'SPAM',status:'OPEN',createdAt:'2026-09-22'}]});
    vi.mocked(apiClient.put).mockResolvedValue({});
    render(<MemoryRouter><ContentReportsPanel /></MemoryRouter>); await screen.findByText('Reported text');
    expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Mark reviewed'}));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/admin/content-reports/4',{status:'REVIEWED'},expect.anything()));
    expect(apiClient.post).not.toHaveBeenCalled();
});
