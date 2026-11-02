import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdmissionFollowUp } from '../../admissions/club/AdmissionFollowUp';
import { AdmissionHandoffStart } from './AdmissionHandoffStart';
import { loadHandoff, type HandoffContext, type HandoffOverview, type HandoffScope } from './api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const language = vi.hoisted(() => ({ current: 'en' }));
const clipboard = vi.hoisted(() => vi.fn());
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: language.current, language: language.current } }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
vi.mock('../records/RecordChoicePicker', () => ({ RecordChoicePicker: ({ onChange }: { onChange: (value: string) => void }) => <button type="button" onClick={() => onChange('83')}>Choose actual kit asset</button> }));
const scope: HandoffScope = { clubId: 12, caseId: 40, caseVersion: 7, actorId: 9, sessionId: 'handoff-session' };
const overview: HandoffOverview = { ...scope, actions: [
    { target: 'FINANCE', canStart: true, receivers: [{ id: 9, name: 'Authorized colleague' }] },
    { target: 'EQUIPMENT', canStart: false, receivers: [] },
] };
const context: HandoffContext = { ...scope, playerId: 51, playerName: 'Canonical placed child', squadId: 66, squadName: 'Actual squad',
    offerId: 70, target: 'FINANCE', startDate: '2026-10-01', endDate: null, feesKnown: true,
    charges: [{ label: 'Accepted fee', amount: 20, currency: 'GEL', frequency: 'Monthly' }], records: [{ id: 81, status: 'WAIVED' }] };
const onClose = vi.fn(), onOpenRecord = vi.fn();
beforeEach(() => {
    vi.resetAllMocks(); language.current = 'en'; localStorage.clear(); sessionStorage.clear();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
    clipboard.mockResolvedValue(undefined);
    localStorage.setItem('gk-session-id', scope.sessionId!); localStorage.setItem('userId', String(scope.actorId));
    api.get.mockResolvedValue({ data: context });
    api.post.mockResolvedValue({ data: { actorId: 9, clubId: 12, caseId: 40, recordId: 91 } });
});
afterEach(cleanup);
function open(target: 'FINANCE' | 'EQUIPMENT' = 'FINANCE') {
    return render(<AdmissionHandoffStart scope={scope} target={target} onClose={onClose} onOpenRecord={onOpenRecord} />);
}
async function fee() {
    await screen.findByLabelText('Agreed amount');
    fireEvent.change(screen.getByLabelText('Agreed amount'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GEL' } });
    fireEvent.change(screen.getByLabelText('Membership period'), { target: { value: 'October' } });
}
it('loads source authority before showing optional actions and passes only opaque source context', async () => {
    api.get.mockResolvedValue({ data: overview }); const onOpen = vi.fn();
    render(<AdmissionFollowUp scope={scope} onOpen={onOpen} />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    fireEvent.click(await screen.findByRole('button', { name: 'Record agreed fee' }));
    expect(onOpen).toHaveBeenCalledWith('finance', { admissionCase: '40', admissionVersion: '7' });
    expect(screen.getByRole('button', { name: 'Issue kit' })).toBeDisabled();
    expect(screen.getByText(/No eligible receiver/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Copy kit follow-up link' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
});
it.each([403, 404, 500])('renders an honest %i error without private context or save controls', async status => {
    api.get.mockRejectedValue({ response: { status } }); open();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText('Canonical placed child')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agreed amount')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
});
it('preserves no-fee and waived-record context without creating a new charge', async () => {
    api.get.mockResolvedValue({ data: { ...context, charges: [] } }); open();
    expect(await screen.findByText(/No fee is listed/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '#81 · Waived' }));
    expect(onOpenRecord).toHaveBeenCalledWith(81); expect(api.post).not.toHaveBeenCalled();
});
it('deliberately creates exactly the placed player/squad canonical fee with a creation key', async () => {
    open(); await fee(); fireEvent.click(screen.getByRole('button', { name: 'Record agreed fee' }));
    await screen.findByRole('button', { name: 'Open saved record' });
    const [path, body, config] = api.post.mock.calls[0];
    expect(path).toBe('/clubs/12/admissions/cases/40/handoff/FINANCE');
    expect(body).toEqual({ expectedVersion: 7, record: { kind: 'INSTALMENT', title: 'Agreed membership fee', squadId: 66, subjectUserId: 51,
        relatedRecordId: null, assignedUserId: null, eventId: null, sessionId: null, dueOn: null, revision: null, data: { amount: '20', currency: 'GEL', period: 'October' } } });
    expect(config.headers['Idempotency-Key']).toMatch(/^[\da-f-]{36}$/);
    expect(JSON.stringify(body)).not.toMatch(/snapshot|contact|consent|private|guardian/i);
    fireEvent.click(screen.getByRole('button', { name: 'Open saved record' })); expect(onOpenRecord).toHaveBeenCalledWith(91);
    expect(screen.getByText(/No payment was recorded or transferred/)).toBeVisible();
});
it('uses exactly the same key and original details after a lost response, with one in-flight click', async () => {
    let reject!: (error: unknown) => void;
    api.post.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    open(); await fee(); const button = screen.getByRole('button', { name: 'Record agreed fee' });
    fireEvent.click(button); fireEvent.click(button); expect(api.post).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('response lost')));
    await screen.findByRole('button', { name: 'Retry same save' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry same save' })).toBeEnabled());
    const stored = Object.keys(sessionStorage).map(key => sessionStorage.getItem(key)).join('');
    expect(stored).not.toContain('October'); expect(stored).not.toContain('Canonical placed child');
    fireEvent.click(screen.getByRole('button', { name: 'Retry same save' }));
    await screen.findByRole('button', { name: 'Open saved record' });
    expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
});
it('blocks a fresh creation after reload of an unresolved save', async () => {
    api.post.mockRejectedValue(new Error('lost'));
    const first = open(); await fee(); fireEvent.click(screen.getByRole('button', { name: 'Record agreed fee' }));
    await screen.findByRole('button', { name: 'Retry same save' }); first.unmount(); open();
    await screen.findByText(/A previous save is unresolved/);
    await screen.findByText('Canonical placed child');
    expect(screen.getByRole('button', { name: 'Record agreed fee' })).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(1);
});
it('keeps the draft correctable after a definite initial validation rejection', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 400 } }); open(); await fee();
    fireEvent.click(screen.getByRole('button', { name: 'Record agreed fee' }));
    await screen.findByText(/This save was not confirmed/);
    await waitFor(() => expect(screen.getByLabelText('Membership period')).toBeEnabled());
    expect(screen.getByLabelText('Membership period')).toHaveValue('October');
    fireEvent.change(screen.getByLabelText('Membership period'), { target: { value: 'Agreed period corrected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record agreed fee' }));
    await screen.findByRole('button', { name: 'Open saved record' });
    expect(api.post.mock.calls[1][2].headers['Idempotency-Key']).not.toEqual(api.post.mock.calls[0][2].headers['Idempotency-Key']);
});
it('clears mounted private context after a focus refresh denies current authority', async () => {
    open(); await fee(); api.get.mockRejectedValue({ response: { status: 403 } });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.queryByText('Canonical placed child')).not.toBeInTheDocument());
    expect(screen.queryByLabelText('Membership period')).not.toBeInTheDocument();
    expect(await screen.findByText(/unavailable with your current authority/)).toBeVisible();
});
it('keeps an unsaved draft after a recoverable permission refresh and asks before cancel', async () => {
    open(); await fee(); act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.getByLabelText('Membership period')).toHaveValue('October'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).not.toHaveBeenCalled(); expect(screen.getByRole('group', { name: 'Discard edits' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Membership period')).toHaveValue('October');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }));
    expect(onClose).toHaveBeenCalledOnce();
});
it('removes context and retires pending reads when the account changes', async () => {
    let resolve!: (response: unknown) => void;
    api.get.mockReturnValueOnce(new Promise(done => { resolve = done; })); open();
    act(() => { localStorage.setItem('gk-session-id', 'different-account'); window.dispatchEvent(new Event('gk-auth-changed')); });
    await act(async () => resolve({ data: context }));
    expect(screen.queryByText('Canonical placed child')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your account changed'); expect(api.post).not.toHaveBeenCalled();
});
it.each([{ actorId: 10 }, { clubId: 13 }, { caseId: 41 }, { caseVersion: 8 }, { target: 'EQUIPMENT' }])('rejects wrong returned source/target scope %j', async wrong => {
    api.get.mockResolvedValue({ data: { ...context, ...wrong } });
    await expect(loadHandoff(scope, new AbortController().signal, 'FINANCE')).rejects.toThrow();
});
it('issues only the deliberately selected actual kit using the canonical EQUIPMENT_ISSUE request', async () => {
    api.get.mockResolvedValue({ data: { ...context, target: 'EQUIPMENT', charges: [], feesKnown: false, records: [] } }); open('EQUIPMENT');
    fireEvent.click(await screen.findByRole('button', { name: 'Choose actual kit asset' }));
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Actual condition on issue'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue kit' }));
    await screen.findByRole('button', { name: 'Open saved record' });
    expect(api.post.mock.calls[0][1].record).toMatchObject({ kind: 'EQUIPMENT_ISSUE', squadId: 66, subjectUserId: 51, relatedRecordId: 83, data: { quantity: '1', conditionOut: 'New' } });
});
it('receives through only the limited target endpoint and offers no private case return action', async () => {
    open(); await fee();
    expect(api.get.mock.calls.every(([path]) => path === '/clubs/12/admissions/cases/40/handoff/FINANCE')).toBe(true);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record agreed fee' }));
    await screen.findByRole('button', { name: 'Open saved record' });
    expect(screen.queryByRole('button', { name: 'Back to admission' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(onClose).toHaveBeenCalledOnce();
});
it('localizes the new source labels and eligible-target wording through the app language', async () => {
    language.current = 'ka'; api.get.mockResolvedValue({ data: overview });
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('მიმდინარე ჩარიცხვა და უფლებამოსილება მოწმდება…');
    expect(await screen.findByRole('button', { name: 'შეთანხმებული საწევროს აღრიცხვა' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ეკიპირების გაცემა' })).toBeDisabled();
    expect(screen.getByText('ამჟამად შესაბამისი უფლებამოსილების მქონე მიმღები არ არის.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Record agreed fee' })).not.toBeInTheDocument();
});
it('switches new receiving labels to Georgian without discarding an English-language draft or reloading authority', async () => {
    const view = open(); await fee(); const reads = api.get.mock.calls.length;
    language.current = 'ka'; view.rerender(<AdmissionHandoffStart scope={scope} target="FINANCE" onClose={onClose} onOpenRecord={onOpenRecord} />);
    expect(screen.getByLabelText('შეთანხმებული თანხა')).toHaveValue(20);
    expect(screen.getByLabelText('ვალუტა')).toHaveValue('GEL');
    expect(screen.getByLabelText('საწევროს პერიოდი')).toHaveValue('October');
    expect(screen.getByRole('heading', { name: 'მიღებული საწევრო პირობები' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'გაუქმება' })).toBeVisible();
    expect(api.get).toHaveBeenCalledTimes(reads);
    fireEvent.click(screen.getByRole('button', { name: 'შეთანხმებული საწევროს აღრიცხვა' }));
    expect(await screen.findByRole('button', { name: 'შენახული ჩანაწერის გახსნა' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'დახურვა' })).toBeVisible();
    expect(screen.getByText(/გადახდა არ აღრიცხულა და თანხა არ გადარიცხულა/)).toBeVisible();
});
it('localizes kit labels and does not show fee terms in the equipment projection', async () => {
    language.current = 'ka'; api.get.mockResolvedValue({ data: { ...context, target: 'EQUIPMENT', charges: [], feesKnown: false } }); open('EQUIPMENT');
    expect(await screen.findByLabelText('რაოდენობა')).toBeVisible();
    expect(screen.getByLabelText('რეალური მდგომარეობა გაცემისას')).toBeVisible();
    expect(screen.getByRole('button', { name: 'ეკიპირების გაცემა' })).toBeVisible();
    expect(screen.queryByText('მიღებული საწევრო პირობები')).not.toBeInTheDocument();
});
it.each([403, 404, 409, 500])('localizes the receiving %i error instead of exposing an English exception', async status => {
    language.current = 'ka'; api.get.mockRejectedValue({ response: { status }, message: 'PRIVATE_EXCEPTION' }); open();
    expect(await screen.findByRole('alert')).not.toHaveTextContent('PRIVATE_EXCEPTION');
    expect(screen.getByRole('button', { name: 'ხელახლა ცდა' })).toBeVisible();
    expect(screen.getByRole('alert').textContent).toMatch(/[ა-ჰ]/);
});
it.each(['FINANCE', 'EQUIPMENT'] as const)('lets a source-only colleague explicitly copy a safe reachable %s Office link without sending or creating anything', async target => {
    api.get.mockResolvedValue({ data: { ...overview, actions: [{ target, canStart: false, receivers: [{ id: 101, name: 'Eligible target-only colleague' }] }] } });
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    const title = target === 'FINANCE' ? 'fee' : 'kit';
    const button = await screen.findByRole('button', { name: `Copy ${title} follow-up link` });
    expect(screen.getByRole('button', { name: target === 'FINANCE' ? 'Record agreed fee' : 'Issue kit' })).toBeDisabled();
    expect(clipboard).not.toHaveBeenCalled(); fireEvent.click(button);
    await screen.findByText('Link copied. This does not mean it was received, read or completed.');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(clipboard).toHaveBeenCalledTimes(1);
    const url = new URL(clipboard.mock.calls[0][0]);
    expect(url.origin).toBe(window.location.origin); expect(url.pathname).toBe('/clubs/12/office');
    expect(Object.fromEntries(url.searchParams)).toEqual({ tab: 'tools', tool: target === 'FINANCE' ? 'finance' : 'equipment', admissionCase: '40', admissionVersion: '7' });
    expect(url.hash).toBe(''); expect(url.toString()).not.toMatch(/Eligible|child|name|guardian|amount|actorId|playerId|snapshot/);
    expect(api.post).not.toHaveBeenCalled(); expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('does not expose a copy action when private source overview is denied', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Copy .*follow-up link/ })).not.toBeInTheDocument();
    expect(clipboard).not.toHaveBeenCalled();
});
it('rechecks source authority before copying and refuses after revocation', async () => {
    api.get.mockResolvedValueOnce({ data: overview });
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    const button = await screen.findByRole('button', { name: 'Copy fee follow-up link' });
    api.get.mockRejectedValue({ response: { status: 403 } }); fireEvent.click(button);
    await screen.findByRole('alert'); expect(clipboard).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Fee follow-up link')).not.toBeInTheDocument();
});
it('offers a read-only safe link for manual copying when the clipboard fails', async () => {
    api.get.mockResolvedValue({ data: overview }); clipboard.mockRejectedValue(new Error('blocked'));
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy fee follow-up link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select the link');
    expect(screen.getByLabelText('Fee follow-up link')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Fee follow-up link')).toHaveValue(`${window.location.origin}/clubs/12/office?tab=tools&tool=finance&admissionCase=40&admissionVersion=7`);
    expect(api.post).not.toHaveBeenCalled();
});
it('retires a pending copy authority response after an account change', async () => {
    api.get.mockResolvedValueOnce({ data: overview });
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    const button = await screen.findByRole('button', { name: 'Copy fee follow-up link' });
    let resolve!: (response: unknown) => void;
    api.get.mockReturnValueOnce(new Promise(done => { resolve = done; })); fireEvent.click(button);
    act(() => { localStorage.setItem('gk-session-id', 'another-account'); window.dispatchEvent(new Event('gk-auth-changed')); });
    await act(async () => resolve({ data: overview }));
    expect(clipboard).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Fee follow-up link')).not.toBeInTheDocument();
});
it('localizes the explicit copy action and copied-state meaning in Georgian', async () => {
    language.current = 'ka'; api.get.mockResolvedValue({ data: overview });
    render(<AdmissionFollowUp scope={scope} onOpen={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'საწევროს საკითხის ბმულის კოპირება' }));
    expect(await screen.findByText('ბმული დაკოპირდა. ეს მიღებას, წაკითხვას ან დასრულებას არ ნიშნავს.')).toBeVisible();
    expect(screen.getByLabelText('საწევროს საკითხის ბმული')).toHaveAttribute('readonly');
});
