import { addDays, today, zonedInstant } from './utils';
import { VenueBookingFlow } from './VenueBookingFlow';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VenueListingEditor, VenuePitchEditor } from './VenueEditors';
import { StadiumWorkspacePage } from '../../pages/StadiumWorkspacePage';
import { useAuth } from '../../context/AuthContext';
import { createBooking, fetchVenue, fetchVenueBookings, savePitch, saveVenue, type Venue } from './api';
import { apiClient } from '../../api/axiosConfig';
import { prepareCropSource, getCroppedImg } from '../../utils/cropImageHelper';

vi.mock('../../hooks/useMediaSource', () => ({ useMediaSource: (src?: string) => src }));
vi.mock('../../utils/cropImageHelper', async () => ({ ...(await vi.importActual('../../utils/cropImageHelper')), prepareCropSource: vi.fn(), getCroppedImg: vi.fn() }));
vi.mock('../../ui/ImageCropperModal', () => ({ ImageCropperModal: ({ title, onCropComplete, onClose, error, isProcessing }: { title: string; onCropComplete: (crop: { x: number; y: number; width: number; height: number }) => void; onClose: () => void; error?: string; isProcessing?: boolean }) => <div role="dialog" aria-label={title}><button type="button" disabled={isProcessing} onClick={() => onCropComplete({ x: 0, y: 0, width: 1600, height: 900 })}>Use photo</button><button type="button" onClick={onClose}>Cancel crop</button>{error && <p role="alert">{error}</p>}</div> }));

vi.mock('./VenueMap', () => ({ VenueMap: () => <div>Location map</div> }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./api', async () => ({ ...(await vi.importActual('./api')), createBooking: vi.fn(), fetchVenue: vi.fn(), fetchVenueBookings: vi.fn(), savePitch: vi.fn(), saveVenue: vi.fn() }));

const venue: Venue = {
    capabilities: { enabledActivities: ['PROFILE', 'VENUE', 'TOURNAMENT'], revision: 0, venueAvailable: true,
        canConfigureActivities: true, canEditProfile: true, canConfigureVenue: true,
        canManageVenueBookings: true, canCreateTournament: true, canInviteVenueOperator: true },
    id: 22, revision: 8, displayName: 'Test Stadium', description: '', city: 'Tbilisi', addressText: 'Test address', latitude: 41, longitude: 44,
    timezone: 'Asia/Tbilisi', currency: 'GEL', publicPhone: '+995555123456', publicEmail: '', website: '', bookingMode: 'REQUEST', published: true,
    cancellationHours: 24, minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30, amenities: ['Floodlights'], photos: [{ url: "/venue-demo/cover.jpg", caption: "" }], openingHours: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "23:00" }], canManage: true, verificationStatus: 'UNVERIFIED',
    pitches: [{ id: 9, revision: 2, name: 'Main pitch', format: '5_A_SIDE', surface: 'ARTIFICIAL_GRASS', covered: false, pricePerHour: 80, active: true, resourceGroup: 'main', resourceUnits: ['left', 'right'] }],
};
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 7 }, sessionId: 'owner' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(fetchVenue).mockResolvedValue(venue);
    vi.mocked(fetchVenueBookings).mockResolvedValue([]);
    vi.mocked(saveVenue).mockResolvedValue({ ...venue, revision: 9 });
    vi.mocked(savePitch).mockResolvedValue({ ...venue, revision: 9 });
    vi.mocked(createBooking).mockResolvedValue([]);
    vi.mocked(prepareCropSource).mockResolvedValue('blob:pitch-photo');
    vi.mocked(getCroppedImg).mockResolvedValue(new File(['cropped'], 'banner.jpg', { type: 'image/jpeg' }));
});

it('uploads a cropped pitch photo, preserves it through a failed save and shows the saved pitch destination', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { url: '/uploads/pitch.jpg' } });
    const saved = { ...venue.pitches[0], id: 15, revision: 0, name: 'Training pitch', photoUrl: '/uploads/pitch.jpg' };
    vi.mocked(savePitch).mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({ ...venue, pitches: [...venue.pitches, saved] });
    render(<VenuePitchEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Pitch name'), { target: { value: 'Training pitch' } });
    const file = new File(['photo'], 'pitch.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Add pitch photo'), { target: { files: [file] } });
    expect(await screen.findByRole('dialog', { name: 'Adjust pitch photo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save pitch' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(prepareCropSource).toHaveBeenCalledWith(file);
    expect(post).toHaveBeenCalledWith('/media/upload', expect.any(FormData), { params: { context: 'banner' } });
    expect(vi.mocked(getCroppedImg).mock.calls[0][3]).toBe(1920);
    expect(within(screen.getByLabelText('Pitch preview')).getByRole('img')).toHaveAttribute('src', expect.stringContaining('/uploads/pitch.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Pitch name')).toHaveValue('Training pitch');
    expect(screen.getByRole('img', { name: 'Pitch photo draft' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
    await waitFor(() => expect(savePitch).toHaveBeenCalledTimes(2));
    expect(savePitch).toHaveBeenLastCalledWith(22, expect.objectContaining({ photoUrl: '/uploads/pitch.jpg', name: 'Training pitch' }));
    expect(await screen.findByRole('heading', { name: 'Your pitch is saved' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'View saved pitch' })).toHaveAttribute('href', '/stadiums/22#pitch-15');
    expect(screen.getByRole('status')).toHaveTextContent('Training pitch created.');
    expect(within(screen.getByLabelText('Pitch preview')).getByText('Saved pitch')).toBeVisible();
    post.mockRestore();
});

it('keeps the crop available for retry after upload fails', async () => {
    const post = vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Upload interrupted')).mockResolvedValueOnce({ data: { url: '/uploads/retry.jpg' } });
    render(<VenuePitchEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Add pitch photo'), { target: { files: [new File(['photo'], 'pitch.png', { type: 'image/png' })] } });
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload interrupted');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(savePitch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'Pitch photo draft' })).toHaveAttribute('src', expect.stringContaining('/uploads/retry.jpg'));
    post.mockRestore();
});

it('removes the saved photo explicitly and distinguishes a draft pitch from a public booking', async () => {
    const draftVenue = { ...venue, published: false, pitches: [{ ...venue.pitches[0], photoUrl: '/uploads/original.jpg' }] };
    render(<VenuePitchEditor venue={draftVenue} onSave={vi.fn()}/>);
    expect(screen.getByRole('link', { name: 'Preview pitch' })).toHaveAttribute('href', '/stadiums/22#pitch-9');
    expect(screen.queryByText('Available to book')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Main pitch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove pitch photo' }));
    expect(screen.queryByRole('img', { name: 'Pitch photo draft' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
    await waitFor(() => expect(savePitch).toHaveBeenCalledWith(22, expect.objectContaining({ id: 9, photoUrl: '' })));
});

it('keeps public pitch links hidden when promotion is blocked, including after saving', async () => {
    const blocked = { ...venue, promotionBlocked: true };
    vi.mocked(savePitch).mockResolvedValue(blocked);
    render(<VenuePitchEditor venue={blocked} onSave={vi.fn()}/>);
    expect(screen.queryByRole('link', { name: 'View pitch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Main pitch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
    await screen.findByRole('heading', { name: 'Your pitch is saved' });
    expect(screen.queryByRole('link', { name: 'View saved pitch' })).not.toBeInTheDocument();
});

it('sends the loaded revision and permits clearing optional amenities', async () => {
    const onSave = vi.fn(); render(<VenueListingEditor venue={venue} onSave={onSave}/>);
    fireEvent.change(screen.getByLabelText(/Amenities/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save stadium' }));
    await waitFor(() => expect(saveVenue).toHaveBeenCalledWith(22, expect.objectContaining({ revision: 8, amenities: [] })));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ revision: 9 }));
});

it('creates independent pitches with revision zero and edits existing pitch revisions', async () => {
    render(<VenuePitchEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Pitch name'), { target: { value: 'Training pitch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
    await waitFor(() => expect(savePitch).toHaveBeenCalledWith(22, expect.objectContaining({ revision: 0, name: 'Training pitch', resourceGroup: '', resourceUnits: [] })));
    fireEvent.click(screen.getByRole('button', { name: /Main pitch/ }));
    fireEvent.change(screen.getByLabelText('Sections used (comma separated)'), { target: { value: 'left, right, ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pitch' }));
    await waitFor(() => expect(savePitch).toHaveBeenLastCalledWith(22, expect.objectContaining({ id: 9, revision: 2, resourceUnits: ['left', 'right'] })));
});

it('keeps an unsaved edit visible after an optimistic locking conflict', async () => {
    vi.mocked(saveVenue).mockRejectedValue({ response: { status: 409, data: { error: 'Another manager changed this stadium. Refresh before saving.' } } });
    render(<VenueListingEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Stadium name'), { target: { value: 'My unsaved change' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save stadium' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Another manager changed');
    expect(screen.getByLabelText('Stadium name')).toHaveValue('My unsaved change');
});

it('records an overnight recurring closure using venue-time instants and an idempotency key', async () => {
    render(<MemoryRouter initialEntries={['/stadiums/22/manage']}><Routes><Route path="/stadiums/:organizationId/manage" element={<StadiumWorkspacePage/>}/></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add booking or closure' }));
    fireEvent.click(screen.getByRole('button', { name: /Close a pitch/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const startDate = addDays(today(), 7), endDate = addDays(startDate, 1);
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: startDate } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: endDate } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '23:00' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '01:00' } });
    fireEvent.change(screen.getByLabelText('Repeat weekly'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review booking' }));
    expect(createBooking).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Block these times' }));
    await waitFor(() => expect(createBooking).toHaveBeenCalledWith(22, expect.objectContaining({ kind: 'CLOSURE', startsAt: zonedInstant(startDate, '23:00', venue.timezone), endsAt: zonedInstant(endDate, '01:00', venue.timezone), repeatWeeks: 4, requestId: expect.stringMatching(/^[a-f0-9-]{36}$/) })));
});

it('updates the stadium preview immediately and keeps the draft while switching workspace tabs', async () => {
    render(<MemoryRouter initialEntries={['/stadiums/22/manage']}><Routes><Route path="/stadiums/:organizationId/manage" element={<StadiumWorkspacePage/>}/></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Stadium page' }));
    fireEvent.change(screen.getByLabelText('Stadium name'), { target: { value: 'A clearer name' } });
    expect(within(screen.getByLabelText('Stadium page preview')).getByRole('heading', { name: 'A clearer name' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar & reservations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stadium page' }));
    expect(screen.getByLabelText('Stadium name')).toHaveValue('A clearer name');
    expect(saveVenue).not.toHaveBeenCalled();
});

it('reveals a missing field on a hidden step instead of silently failing the save', async () => {
    render(<VenueListingEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: /Location & contact/ }));
    fireEvent.change(screen.getByLabelText('Venue timezone'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Details & photos/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save stadium' }));
    expect(screen.getByLabelText('Venue timezone')).toBeVisible();
    expect(saveVenue).not.toHaveBeenCalled();
});

it('requires complete public details before publishing but still permits a draft', async () => {
    render(<VenueListingEditor venue={{ ...venue, published: false, photos: [] }} onSave={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: /Review & publish/ }));
    fireEvent.click(screen.getByLabelText('Publish stadium page'));
    fireEvent.click(screen.getByRole('button', { name: 'Save stadium' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Complete the items');
    expect(saveVenue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Publish stadium page'));
    fireEvent.click(screen.getByRole('button', { name: 'Save stadium' }));
    await waitFor(() => expect(saveVenue).toHaveBeenCalledWith(22, expect.objectContaining({ published: false })));
});

async function fillBooking() {
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Customer / academy name'), { target: { value: 'Demo team' } });
    fireEvent.change(screen.getByLabelText('Contact phone'), { target: { value: '+995555000123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review booking' }));
}

it('reviews the rate and preserves the same request key after an uncertain save', async () => {
    vi.mocked(createBooking).mockRejectedValueOnce(new Error('Connection interrupted'));
    render(<VenueBookingFlow venue={venue} date={addDays(today(), 7)} onSave={vi.fn()} onCancel={vi.fn()}/>);
    await fillBooking();
    expect(createBooking).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Add confirmed booking' }));
    await screen.findByRole('alert');
    const first = vi.mocked(createBooking).mock.calls[0][1];
    expect(first).toEqual(expect.objectContaining({ expectedTotalPrice: 80, currency: 'GEL', kind: 'MANUAL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add confirmed booking' }));
    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createBooking).mock.calls[1][1].requestId).toBe(first.requestId);
});

it('detects shared-ground conflicts in any week before offering confirmation', async () => {
    const date = addDays(today(), 7);
    const other = { ...venue.pitches[0], id: 10, name: 'Left half', resourceUnits: ['left'] };
    vi.mocked(fetchVenueBookings).mockResolvedValue([{ id: 51, pitchId: 10, startsAt: zonedInstant(addDays(date,7),'18:00',venue.timezone), endsAt: zonedInstant(addDays(date,7),'19:00',venue.timezone), status: 'CONFIRMED' } as never]);
    render(<VenueBookingFlow venue={{...venue, pitches:[...venue.pitches, other]}} date={date} onSave={vi.fn()} onCancel={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Repeat weekly'), {target:{value:'4'}});
    await fillBooking();
    expect(await screen.findByRole('alert')).toHaveTextContent('overlap an existing booking');
    expect(screen.queryByRole('button', { name: 'Add confirmed booking' })).not.toBeInTheDocument();
    expect(createBooking).not.toHaveBeenCalled();
});

it('offers only closures when venue booking intake is paused', () => {
    render(<VenueBookingFlow venue={{...venue, capabilities:{...venue.capabilities!,enabledActivities:['PROFILE']}}} date={addDays(today(),7)} onSave={vi.fn()} onCancel={vi.fn()}/>);
    expect(screen.queryByRole('button', {name:/Customer booking/})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name:/Close a pitch/})).toHaveAttribute('aria-pressed','true');
});

it('keeps an unsaved pitch until the owner explicitly discards it when switching pitches', () => {
    render(<VenuePitchEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Pitch name'), {target:{value:'Unsaved training pitch'}});
    fireEvent.click(screen.getByRole('button',{name:/Main pitch/}));
    expect(screen.getByRole('region',{name:'Unsaved pitch changes'})).toBeVisible();
    expect(screen.getByLabelText('Pitch name')).toHaveValue('Unsaved training pitch');
    fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
    expect(screen.getByLabelText('Pitch name')).toHaveValue('Unsaved training pitch');
    fireEvent.click(screen.getByRole('button',{name:/Main pitch/}));
    fireEvent.click(screen.getByRole('button',{name:'Discard pitch changes'}));
    expect(screen.getByLabelText('Pitch name')).toHaveValue('Main pitch');
    expect(savePitch).not.toHaveBeenCalled();
});

it('uses an existing ground and chosen sections when adding a pitch option', async () => {
    render(<VenuePitchEditor venue={venue} onSave={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Pitch name'),{target:{value:'Left half'}});
    fireEvent.click(screen.getByRole('button',{name:'Continue'}));
    fireEvent.change(screen.getByLabelText('Physical space'),{target:{value:'main'}});
    fireEvent.click(screen.getByLabelText('Right half'));
    fireEvent.click(screen.getByRole('button',{name:'Save pitch'}));
    await waitFor(() => expect(savePitch).toHaveBeenCalledWith(22,expect.objectContaining({name:'Left half',resourceGroup:'main',resourceUnits:['left']})));
});
