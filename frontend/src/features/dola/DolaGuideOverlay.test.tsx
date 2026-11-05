import '../../i18n';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { DolaGuideOverlay } from './DolaGuideOverlay';
import { currentGuide, startGuide, stopGuide } from './dolaGuide';

const PROFILE = { title: 'Your profile', webPath: '/account?tab=profile', scan: false, steps: [
    { target: 'bio', label: 'Bio', hint: 'A few lines about you.', required: false },
    { target: 'save', label: 'Save', hint: 'Press Save.', required: true },
] };

function Where() { const location = useLocation(); return <p data-testid="where">{location.pathname + location.search}</p>; }
function ProfilePage() {
    return <main><label data-dola-field="bio"><span>Bio</span><textarea aria-label="Bio" /></label><button data-dola-action="save">Save Profile</button></main>;
}
const mount = (at: string) => render(<MemoryRouter initialEntries={[at]}>
    <Routes><Route path="/account" element={<ProfilePage />} /><Route path="*" element={<main />} /></Routes>
    <Where /><DolaGuideOverlay />
</MemoryRouter>);

beforeEach(() => window.sessionStorage.clear());
afterEach(() => act(() => stopGuide()));

it('frames each field in turn on its page and moves on with Next', async () => {
    act(() => startGuide(PROFILE));
    mount('/account?tab=profile');

    expect(await screen.findByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('A few lines about you.')).toBeInTheDocument();
    // The guide sits directly under <body>, over any dialog.
    await waitFor(() => expect(document.body.querySelector(':scope > [data-dialog-companion] .dola-guide__frame')).not.toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Bio' }));

    await userEvent.type(screen.getByRole('textbox', { name: 'Bio' }), 'Midfielder');
    expect(await screen.findByText('Filled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(currentGuide()).toBeNull();
});

it('opens the guide’s page when the person is elsewhere', async () => {
    act(() => startGuide(PROFILE));
    mount('/team-work');

    expect(screen.getByText('These fields are on another page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Open it/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account?tab=profile');
    expect(await screen.findByText('Step 1 of 2')).toBeInTheDocument();
});

it('reads a page Dola only knows by name for its empty fields', async () => {
    act(() => startGuide({ title: 'Club page', webPath: null, scan: true, steps: [] }));
    render(<MemoryRouter><main><label>Club name<input value="Dinamo" readOnly={false} onChange={() => undefined} /></label>
        <label>Contact email *<input type="email" /></label></main><DolaGuideOverlay /></MemoryRouter>);

    expect(screen.getByText('Checking what’s still empty on this page…')).toBeInTheDocument();
    expect(await screen.findByText('Step 1 of 1', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Contact email/ })).toBeInTheDocument();
});

it('closes with Escape', async () => {
    act(() => startGuide(PROFILE));
    mount('/account?tab=profile');
    await screen.findByText('Step 1 of 2');
    await userEvent.keyboard('{Escape}');
    expect(currentGuide()).toBeNull();
});

it('frames a field in a drawer over the page, and stays usable while the drawer keeps the page inert', async () => {
    act(() => startGuide({ title: 'Create a tournament', webPath: '/world/tournaments?peek=draw-new', scan: false, steps: [
        { target: 'organiser', label: 'Who organises it', hint: null, required: true },
        { target: 'draw-name', label: 'Name', hint: null, required: true },
    ] }));
    // World's drawers are portalled outside <main>; the form in the open one is the one being filled.
    function Drawer() {
        return <div role="dialog" aria-modal="true"><p data-dola-field="organiser" data-dola-filled="true" tabIndex={-1}>Riverside</p>
            <label><span>Name</span><input id="draw-name" /></label></div>;
    }
    render(<MemoryRouter initialEntries={['/world/tournaments?peek=draw-new']}><main /><Drawer /><DolaGuideOverlay /></MemoryRouter>);

    expect(await screen.findByText('Filled')).toBeInTheDocument();
    expect(screen.queryByText(/I can’t see this field/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
});

it('frames folded rules by their heading, without opening them', async () => {
    act(() => startGuide({ title: 'Create a tournament', webPath: null, scan: false, steps: [
        { target: 'rulesDetail', label: 'Rules in detail', hint: 'The usual rules are already set.', required: false },
    ] }));
    render(<MemoryRouter><main><details><summary data-dola-field="rulesDetail" data-dola-filled="true">Rules in detail</summary>
        <label>Rules<textarea /></label></details></main><DolaGuideOverlay /></MemoryRouter>);

    expect(await screen.findByText('Filled')).toBeInTheDocument();
    expect(screen.queryByText(/I can’t see this field/)).toBeNull();
    expect(document.querySelector('details')).not.toHaveAttribute('open');
    expect(document.activeElement).toBe(document.querySelector('summary'));
});

it('ends when the person leaves its page from the last step, as after Create', async () => {
    act(() => startGuide(PROFILE));
    function Leave() { const navigate = useNavigate(); return <button type="button" onClick={() => navigate('/world/tournaments?peek=tournament-7')}>Created</button>; }
    render(<MemoryRouter initialEntries={['/account?tab=profile']}>
        <Routes><Route path="/account" element={<ProfilePage />} /><Route path="*" element={<main />} /></Routes>
        <Leave /><DolaGuideOverlay />
    </MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Created' }));
    await waitFor(() => expect(currentGuide()).toBeNull());
});

it('ends when the last step’s button closes its window, and not when the person only goes back', async () => {
    const steps = [
        { target: 'event-title', label: 'Event name', hint: null, required: true },
        { target: 'save-event', label: 'Create event', hint: null, required: true },
    ];
    function Editor() {
        const [open, setOpen] = useState(true);
        const [screen2, setScreen2] = useState(true);
        return <main>{open && <div role="dialog">
            <input data-dola-field="event-title" aria-label="Event name" defaultValue="Training" />
            {screen2 && <button type="button" data-dola-action="save-event" onClick={() => setOpen(false)}>Create event</button>}
            <button type="button" onClick={() => setScreen2(value => !value)}>Previous screen</button>
        </div>}</main>;
    }
    act(() => startGuide({ title: 'New event', webPath: null, scan: false, steps }));
    render(<MemoryRouter><Editor /><DolaGuideOverlay /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    // Back in the window hides the button without pressing it: the guide waits.
    await userEvent.click(screen.getByRole('button', { name: 'Previous screen' }));
    expect(await screen.findByText(/I can’t see this field/)).toBeInTheDocument();
    expect(currentGuide()).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Previous screen' }));
    // Pressing it closes the window: the guide is done.
    await userEvent.click(await screen.findByRole('button', { name: 'Create event' }));
    await waitFor(() => expect(currentGuide()).toBeNull());
});
