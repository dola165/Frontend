import '../../../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makePage } from '../../__tests__/fixtures';
import { SponsorsBox, HonoursBox } from '../../boxes/ListBoxes';
import { PageEditContext, type PageEdit } from '../context';

function mount(kind: 'sponsors' | 'honours', succeeds = true) {
  const page = makePage({ kind: 'CLUB' }), saveBox = vi.fn().mockResolvedValue(succeeds), close = vi.fn();
  const context = { page, saveBox, registerField: vi.fn() } as unknown as PageEdit;
  const Box = kind === 'sponsors' ? SponsorsBox : HonoursBox;
  render(<MemoryRouter><PageEditContext.Provider value={context}><Box page={page} editing open onEdit={vi.fn()} onClose={close} /></PageEditContext.Provider></MemoryRouter>);
  return { saveBox, close };
}

it('sends a new sponsor without a temporary UI ID and keeps its editor open on a rejected save', async () => {
  const { saveBox, close } = mount('sponsors', false);
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Local sponsor' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Website' }), { target: { value: 'example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(saveBox).toHaveBeenCalledWith('sponsors', { items: [{ id: undefined, name: 'Local sponsor', websiteUrl: 'https://example.test', logoUrl: null, organizationId: null }] }, expect.anything()));
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Local sponsor');
});

it('retains an honour with an unknown year rather than silently dropping it', async () => {
  const { saveBox, close } = mount('honours');
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Founders cup' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(saveBox).toHaveBeenCalledWith('honours', { items: [{ id: undefined, title: 'Founders cup', year: null }] }, expect.anything()));
  expect(close).toHaveBeenCalledTimes(1);
});
