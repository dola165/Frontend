import { lazy, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n';
import { RouteViewport } from '../RouteViewport';

afterEach(() => vi.restoreAllMocks());

describe('route loading recovery', () => {
    it('keeps navigation available after a chunk fails and recovers on another route', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const Broken = lazy(() => Promise.reject(new Error('Chunk unavailable')));
        const user = userEvent.setup();
        render(<MemoryRouter initialEntries={['/broken']}><Link to="/good">Clubs</Link><RouteViewport><Routes>
            <Route path="/broken" element={<Broken/>}/><Route path="/good" element={<h1>Available clubs</h1>}/>
        </Routes></RouteViewport></MemoryRouter>);
        expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
        await user.click(screen.getByRole('link', {name:'Clubs'}));
        expect(await screen.findByRole('heading', {name:'Available clubs'})).toBeInTheDocument();
    });
    it('retains page state across presentation-only parent renders', async () => {
        const Page = () => {const [draft,setDraft]=useState(''); return <input aria-label="Draft" value={draft} onChange={e=>setDraft(e.target.value)}/>;};
        const Shell = ({label}:{label:string}) => <MemoryRouter><span>{label}</span><RouteViewport><Page/></RouteViewport></MemoryRouter>;
        const user=userEvent.setup();const view=render(<Shell label="English"/>);
        await user.type(screen.getByRole('textbox', {name:'Draft'}),'Saved in the open page');
        view.rerender(<Shell label="Georgian"/>);
        expect(screen.getByRole('textbox', {name:'Draft'})).toHaveValue('Saved in the open page');
    });
});
