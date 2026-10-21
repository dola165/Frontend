import { lazy, useState, type ComponentType } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import '../../../i18n';
import { RouteViewport } from '../RouteViewport';

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('starts a distinct pushed page at the top only after its suspended content commits', async () => {
    let release!: (value: { default: ComponentType }) => void;
    const pending = new Promise<{ default: ComponentType }>(resolve => { release = resolve; });
    const Product = lazy(() => pending);
    render(<MemoryRouter initialEntries={['/store']}><Link to="/store/products/1101">Open shirt</Link><RouteViewport><Routes>
        <Route path="/store" element={<h1>Store</h1>} /><Route path="/store/products/:id" element={<Product />} />
    </Routes></RouteViewport></MemoryRouter>);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Open shirt' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Loading page');
    expect(window.scrollTo).not.toHaveBeenCalled();
    await act(async () => release({ default: () => <h1>Home shirt</h1> }));
    expect(await screen.findByRole('heading', { name: 'Home shirt' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 0, top: 0, behavior: 'instant' });
});

it('keeps scroll and the mounted draft on query-only navigation and presentation renders', () => {
    const Product = () => {
        const [draft, setDraft] = useState('');
        return <><input aria-label="Draft" value={draft} onChange={e => setDraft(e.target.value)} /><Link to="?size=L">Size L</Link></>;
    };
    const Frame = ({ theme }: { theme: string }) => <MemoryRouter initialEntries={['/store']}><span>{theme}</span>
        <Link to="/store/products/1101">Open shirt</Link><RouteViewport><Routes>
            <Route path="/store" element={<h1>Store</h1>} /><Route path="/store/products/:id" element={<Product />} />
        </Routes></RouteViewport></MemoryRouter>;
    const view = render(<Frame theme="dark" />);
    fireEvent.click(screen.getByRole('link', { name: 'Open shirt' }));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'Unsubmitted enquiry' } });
    fireEvent.click(screen.getByRole('link', { name: 'Size L' }));
    view.rerender(<Frame theme="light" />);
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Unsubmitted enquiry');
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
});

it('leaves initial, Back and Forward POP restoration to the browser', () => {
    const Controls = () => { const navigate = useNavigate(); return <><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button></>; };
    render(<MemoryRouter initialEntries={['/store', '/store/products/1101']} initialIndex={1}><Controls /><RouteViewport><Routes>
        <Route path="/store" element={<h1>Store</h1>} /><Route path="/store/products/:id" element={<h1>Home shirt</h1>} />
    </Routes></RouteViewport></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Store' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(screen.getByRole('heading', { name: 'Home shirt' })).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();
});

it('preserves the World family scroll owner and mounted state across its paths', () => {
    const World = () => {
        const [child, setChild] = useState('');
        return <><input aria-label="Selected child" value={child} onChange={e => setChild(e.target.value)} /><Link to="/world/people?view=coaches">People</Link></>;
    };
    render(<MemoryRouter initialEntries={['/store']}><Link to="/world/clubs">World</Link><RouteViewport><Routes>
        <Route path="/store" element={<h1>Store</h1>} /><Route path="/world/*" element={<World />} />
    </Routes></RouteViewport></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'World' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Selected child' }), { target: { value: 'Synthetic child' } });
    fireEvent.click(screen.getByRole('link', { name: 'People' }));
    expect(screen.getByRole('textbox', { name: 'Selected child' })).toHaveValue('Synthetic child');
    expect(window.scrollTo).not.toHaveBeenCalled();
});

it('does not override an anchored destination or subsequent hash/query changes', () => {
    render(<MemoryRouter initialEntries={['/store']}><Link to="/store/products/1101#sizes">Shirt sizes</Link><RouteViewport><Routes>
        <Route path="/store" element={<h1>Store</h1>} /><Route path="/store/products/:id" element={<><h1 id="sizes">Sizes</h1><Link to="?size=L#details">Details</Link></>} />
    </Routes></RouteViewport></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Shirt sizes' }));
    expect(screen.getByRole('heading', { name: 'Sizes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    expect(window.scrollTo).not.toHaveBeenCalled();
});

it('starts a distinct replaced page once while preserving replace-only query updates', () => {
    const Controls = () => { const navigate = useNavigate(); return <><button onClick={() => navigate('/store/products/1101', { replace: true })}>Replace page</button><button onClick={() => navigate('?size=L', { replace: true })}>Replace query</button></>; };
    render(<MemoryRouter initialEntries={['/store']}><Controls /><RouteViewport><Routes>
        <Route path="/store" element={<h1>Store</h1>} /><Route path="/store/products/:id" element={<h1>Shirt</h1>} />
    </Routes></RouteViewport></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Replace page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace query' }));
    expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 0, top: 0, behavior: 'instant' });
});
