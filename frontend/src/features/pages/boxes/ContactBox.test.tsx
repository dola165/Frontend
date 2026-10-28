import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AboutLine } from '../edit/AboutLine';
import { ContactBox } from './ContactBox';

const edit = vi.hoisted(() => ({ saveIdentity: vi.fn(async () => true), page: null as unknown }));
vi.mock('../edit/context', () => ({ usePageEdit: () => edit }));

const pageWith = (social: Record<string, string>, about = '') => ({ identity: { about, contact: { phone: '', email: '' }, social: { website: '', instagram: '', facebook: '', ...social } }, suggestions: null }) as never;
const box = (page: never, open: boolean) => render(<ContactBox page={page} editing open={open} onEdit={() => {}} onClose={() => {}} {...({} as object)} />);
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('asks for the website straight away, and Instagram and Facebook on request', async () => {
    box(pageWith({}), true);
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'rustavi-lions.ge' } });
    expect(screen.queryByLabelText('Facebook')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Instagram and Facebook' }));
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: '@rustavi.lions' } });
    fireEvent.change(screen.getByLabelText('Facebook'), { target: { value: 'facebook.com/rustavilions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(edit.saveIdentity).toHaveBeenCalledWith(
        { contact: { phone: '', email: '' }, social: { website: 'rustavi-lions.ge', instagram: 'rustavi.lions', facebook: 'facebook.com/rustavilions' } }, expect.anything()));
});

it('shows only http(s) links, Facebook included', () => {
    box(pageWith({ website: 'https://rustavi-lions.ge', instagram: 'rustavi.lions', facebook: 'https://www.facebook.com/rustavilions' }), false);
    expect(screen.getByRole('link', { name: /rustavi-lions\.ge/ })).toHaveAttribute('href', 'https://rustavi-lions.ge/');
    expect(screen.getByRole('link', { name: /@rustavi\.lions/ })).toHaveAttribute('href', 'https://www.instagram.com/rustavi.lions');
    expect(screen.getByRole('link', { name: /facebook\.com\/rustavilions/ })).toHaveAttribute('href', 'https://www.facebook.com/rustavilions');
    cleanup();
    box(pageWith({ website: 'javascript:alert(1)', facebook: 'data:text/html,hi' }), false);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('keeps a link typed in the About line as it was typed', async () => {
    edit.page = pageWith({}, 'Grassroots football');
    render(<AboutLine />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    const typed = 'Fixtures on https://rustavi-lions.ge/fixtures?season=2026 and rustavi-lions.ge';
    fireEvent.change(screen.getByRole('textbox', { name: 'About' }), { target: { value: typed } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'About' }), { key: 'Enter' });
    await waitFor(() => expect(edit.saveIdentity).toHaveBeenCalledWith({ about: typed, aboutAuto: false }, expect.anything()));
});
