import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditor } from './ProfileTools';
import { put } from '../matchExchange/api';
vi.mock('../matchExchange/api', async importOriginal => ({ ...await importOriginal<typeof import('../matchExchange/api')>(), put: vi.fn().mockResolvedValue(undefined) }));
it('retains typed officiating details when current access is withdrawn and prevents saving', async () => {
  const user=userEvent.setup(), saved=vi.fn();
  const {rerender}=render(<ProfileEditor profile={null} canManage onSaved={saved}/>);
  await user.type(screen.getByLabelText('About your officiating'),'Keep my draft');
  rerender(<ProfileEditor profile={null} canManage={false} onSaved={saved}/>);
  expect(screen.getByLabelText('About your officiating')).toHaveValue('Keep my draft');
  expect(screen.getByRole('button',{name:'Save profile'})).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Your draft is still here');
  expect(put).not.toHaveBeenCalled();
  rerender(<ProfileEditor profile={null} canManage onSaved={saved}/>);
  await user.click(screen.getByRole('button',{name:'Save profile'}));
  expect(put).toHaveBeenCalledWith('/referees/me',expect.objectContaining({biography:'Keep my draft'}));
});
