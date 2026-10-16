import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PostComposer } from '../PostComposer';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('userId', '7'); });
afterEach(cleanup);

const home = () => render(<MemoryRouter initialEntries={['/home']}><Routes>
    <Route path="/home" element={<PostComposer home compact onPostCreated={() => undefined} />} />
    <Route path="/calendar" element={<p>Calendar</p>} />
</Routes></MemoryRouter>);

it('keeps the words through the Event detour, for the same person only, and never makes an event of them', () => {
    const first = home();
    fireEvent.change(screen.getByRole('textbox', { name: 'Create a post' }), { target: { value: 'Training moved to Friday' } });
    fireEvent.click(screen.getByRole('button', { name: /Event/ }));
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    first.unmount();

    home();
    expect(screen.getByRole('textbox', { name: 'Create a post' })).toHaveValue('Training moved to Friday');
    cleanup();

    localStorage.setItem('userId', '8');
    home();
    expect(screen.getByRole('textbox', { name: 'Create a post' })).toHaveValue('');
});
