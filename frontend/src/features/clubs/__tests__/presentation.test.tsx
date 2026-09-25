import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { ClubPresentationSettings } from '../../../components/workspace/tabs/ClubPresentationSettings';
import { ClubAffiliations, ClubProgrammeSection, ClubSponsors, TrainingPriceHighlight } from '../../../components/club/ClubPresentation';
import { programmePrice, safePublicUrl, trainingSummary, type ClubPresentation, type TrainingProgramme } from '../presentation';

const session = vi.hoisted(() => ({ id: 7, sessionId: 'one' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: session.id }, sessionId: session.sessionId }) }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const programme: TrainingProgramme = { id: 8, name: 'U12', ageMin: 8, ageMax: 12, sessionsPerWeek: 3, priceType: 'FIXED', amount: '150.25', currency: 'GEL', billingPeriod: 'MONTH', trialAmount: '0.00', joiningFee: '10', equipmentFee: null, details: 'Three sessions each week', published: true };
const profile: ClubPresentation = { profileKind: 'ACADEMY', revision: 3, canEdit: true, canManageAffiliations: true, programmes: [programme], sponsors: [], affiliations: [] };
const editor = (id = 1) => <MemoryRouter><ClubPresentationSettings clubId={id} /></MemoryRouter>;
beforeEach(() => { vi.resetAllMocks(); session.sessionId = 'one'; vi.mocked(apiClient.get).mockResolvedValue({ data: profile }); });

it('distinguishes fixed, free, variable and unpublished prices without guessing extra fees', () => {
    expect(programmePrice(programme)).toMatch(/150[.,]25 GEL \/ month/);
    expect(programmePrice({ ...programme, priceType: 'FREE', amount: null })).toBe('Free training');
    expect(programmePrice({ ...programme, priceType: 'VARIES', amount: null })).toMatch(/Price varies/);
    expect(programmePrice({ ...programme, priceType: 'UNPUBLISHED', amount: null })).toBe('Price not published');
    expect(trainingSummary({ ...profile, programmes: [] })).toBeNull();
    expect(trainingSummary({ ...profile, profileKind: 'PROFESSIONAL' })).toContain('U12');
    render(<ClubProgrammeSection presentation={profile} />);
    expect(screen.queryByText('Free trial')).not.toBeInTheDocument();
    expect(screen.queryByText('Not published')).not.toBeInTheDocument();
    expect(screen.queryByText('10 GEL')).not.toBeInTheDocument();
});

it('keeps training prices visible without opening a disclosure and excludes drafts', () => {
    const { container } = render(<TrainingPriceHighlight presentation={{ ...profile, programmes: [programme, { ...programme, id: 9, amount: '1', published: false }] }} />);
    expect(screen.getByText(/150[.,]25 GEL/)).toBeVisible();
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByText(/Joining fee:/)).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute('href', '?tab=teams&programme=8');
});

it('only shows confirmed affiliations and explicitly published sponsors', () => {
    const presentation: ClubPresentation = { ...profile, profileKind: 'PROFESSIONAL', affiliations: [
        { id: 1, clubId: 2, name: 'Confirmed academy', logoUrl: null, profileKind: 'ACADEMY', status: 'ACTIVE', canRespond: false },
        { id: 2, clubId: 3, name: 'Pending academy', logoUrl: null, profileKind: 'ACADEMY', status: 'PENDING', canRespond: false },
    ], sponsors: [{ id: 1, name: 'Local business', logoUrl: null, websiteUrl: 'https://example.com', organizationId: null, published: true }, { id: 2, name: 'Draft sponsor', logoUrl: null, websiteUrl: null, organizationId: null, published: false }] };
    render(<MemoryRouter><ClubAffiliations presentation={presentation} /><ClubSponsors presentation={presentation} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Confirmed academy/ })).toHaveAttribute('href', '/clubs/2');
    expect(screen.queryByText('Pending academy')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft sponsor')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Local business' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(safePublicUrl('javascript:alert(1)')).toBeUndefined();
    expect(safePublicUrl('https://user:password@example.com')).toBeUndefined();
});

it('does not expose a save form after a failed initial load', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
    render(editor());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save profile settings' })).not.toBeInTheDocument();
});

it('withholds restricted sponsorship even if a management payload reaches public rendering', () => {
    const { container } = render(<ClubSponsors presentation={{ ...profile, sponsors: [{ id: 3, name: 'Restricted sponsor', logoUrl: 'https://example.com/private.png', websiteUrl: 'https://example.com', organizationId: null, published: true, promotionBlocked: true }] }}/>);
    expect(container).toBeEmptyDOMElement();
});

it('allows only unpublication of a restricted sponsor and omits read-only metadata from the request', async () => {
    const restricted = { id: 3, name: 'Retained sponsor', logoUrl: null, websiteUrl: null, organizationId: 4, published: true, contentClassification: 'RESTRICTED', contentRevision: 2, promotionBlocked: true };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...profile, sponsors: [restricted] } });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { ...profile, sponsors: [{ ...restricted, published: false }] } });
    render(editor());
    const scope = within(await screen.findByRole('region', { name: 'Sponsor 1' }));
    expect(scope.queryByRole('textbox')).not.toBeInTheDocument();
    expect(scope.queryByRole('button', { name: 'Remove sponsor' })).not.toBeInTheDocument();
    fireEvent.click(scope.getByRole('checkbox', { name: 'Publication requested (restricted)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }));
    await screen.findByText('Public profile settings saved.');
    expect(apiClient.put).toHaveBeenCalledWith('/clubs/1/presentation', expect.objectContaining({ sponsors: [{ id: 3, name: 'Retained sponsor', logoUrl: null, websiteUrl: null, organizationId: 4, published: false }] }));
    expect(screen.getByRole('checkbox', { name: 'Publication requested (restricted)' })).toBeDisabled();
});

it('saves exact decimal strings, the current revision and only editable fields', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { ...profile, revision: 4 } });
    render(editor());
    const scope = within(await screen.findByRole('region', { name: 'Programme 1' }));
    fireEvent.change(scope.getByRole('spinbutton', { name: 'Training amount' }), { target: { value: '175.45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }));
    await screen.findByText('Public profile settings saved.');
    expect(apiClient.put).toHaveBeenCalledWith('/clubs/1/presentation', { revision: 3, profileKind: 'ACADEMY', programmes: [{ ...programme, amount: '175.45' }], sponsors: [] });
});

it('preserves a rejected draft and blocks affiliation actions while unsaved', async () => {
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'Profile changed. Reload before saving.' } } });
    render(editor());
    const scope = within(await screen.findByRole('region', { name: 'Programme 1' }));
    fireEvent.change(scope.getByRole('textbox', { name: 'Programme name' }), { target: { value: 'Keep this draft' } });
    expect(screen.getByRole('textbox', { name: 'Find a parent club' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }));
    await screen.findByRole('alert');
    expect(scope.getByRole('textbox', { name: 'Programme name' })).toHaveValue('Keep this draft');
    expect(screen.getByRole('button', { name: 'Discard draft & reload' })).toBeEnabled();
});

it('only offers acceptance for incoming requests', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...profile, affiliations: [{ id: 1, clubId: 2, name: 'Professional club', profileKind: 'PROFESSIONAL', status: 'PENDING', canRespond: false }] } });
    render(editor());
    await screen.findByText('Waiting for the other club');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeEnabled();
});

it('discards responses from a previous account session', async () => {
    let resolve!: (value: { data: ClubPresentation }) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const view = render(editor());
    session.sessionId = 'two';
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...profile, programmes: [] } });
    view.rerender(editor());
    await screen.findByRole('button', { name: 'Add training programme' });
    await act(async () => { resolve({ data: profile }); });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Programme 1' })).not.toBeInTheDocument());
});

it('lets academy leadership grant profile management without broad staff access', async () => {
    const affiliated = { ...profile, affiliations: [{ id: 4, clubId: 2, name: 'Parent club', logoUrl: null, profileKind: 'PROFESSIONAL' as const, status: 'ACTIVE' as const, canRespond: false, profileManagementEnabled: false }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: affiliated });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { ...affiliated, affiliations: [{ ...affiliated.affiliations[0], profileManagementEnabled: true }] } });
    render(editor());
    fireEvent.click(await screen.findByRole('button', { name: 'Allow parent club to manage profile' }));
    await screen.findByRole('button', { name: 'Revoke profile management' });
    expect(apiClient.put).toHaveBeenCalledWith('/clubs/1/presentation/affiliations/4/profile-management', { enabled: true });
});

it('allows delegated price editing but hides leadership and affiliation controls', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { ...profile, canManageAffiliations: false, affiliations: [{ id: 4, clubId: 2, name: 'Parent club', profileKind: 'PROFESSIONAL', status: 'ACTIVE', canRespond: false, profileManagementEnabled: true }] } });
    render(editor());
    await screen.findByText(/through access granted/);
    expect(screen.getByRole('spinbutton', { name: 'Training amount' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Profile purpose' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'End affiliation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke profile management' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Find a parent club' })).not.toBeInTheDocument();
});

it('links professional managers directly to an authorized academy profile editor', () => {
    render(<MemoryRouter><ClubAffiliations presentation={{ ...profile, profileKind: 'PROFESSIONAL', affiliations: [{ id: 4, clubId: 2, name: 'Academy', logoUrl: null, profileKind: 'ACADEMY', status: 'ACTIVE', canRespond: false, canManageProfile: true }] }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Manage academy profile/ })).toHaveAttribute('href', '/clubs/2/profile-settings');
});

