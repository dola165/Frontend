import { act, fireEvent, render, screen } from '@testing-library/react';
import { RosterPlayerIdentity } from '../RosterPlayerIdentity';
import '../../../i18n';
const api = vi.hoisted(() => ({ fetchPlayerIdentity: vi.fn() }));
vi.mock('../../../features/joining-contract/api', () => api);
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: null }) }));
vi.mock('../../../features/players/PlayerIdentityEditor', () => ({ PlayerIdentityEditor: ({playerId}: {playerId:number}) => <p>Shared editor for {playerId}</p> }));
vi.mock('../../ui/MediaImage', () => ({ MediaImage: (props: {src?:string;alt:string}) => <img {...props} /> }));
const identity = { playerId:23, fullName:'Canonical child', dateOfBirth:'2015-03-04', positions:['GK','CM'], dominantFoot:'BOTH', heightCm:142.5, weightKg:36.1, photoUrl:'/uploads/protected-child.jpg', canEdit:false };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.fetchPlayerIdentity.mockResolvedValue(identity); });
it('shows authorized canonical optional details and keeps staff editing with the guardian', async () => {
  render(<RosterPlayerIdentity playerId={23} onSaved={vi.fn()} />);
  expect(await screen.findByText('Canonical child')).toBeInTheDocument();
  expect(screen.getByText('Goalkeeper, Central midfielder')).toBeInTheDocument();
  expect(screen.getByText('142.5 cm')).toBeInTheDocument(); expect(screen.getByText('36.1 kg')).toBeInTheDocument();
  expect(screen.getByRole('img',{name:'Player photo'})).toHaveAttribute('src',expect.stringContaining('/uploads/protected-child.jpg'));
  expect(screen.queryByRole('button',{name:'Update shared player details'})).not.toBeInTheDocument();
});
it('opens the shared editor only when the canonical response permits editing', async () => {
  api.fetchPlayerIdentity.mockResolvedValue({...identity,canEdit:true});
  render(<RosterPlayerIdentity playerId={23} onSaved={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button',{name:'Update shared player details'}));
  expect(screen.getByText('Shared editor for 23')).toBeInTheDocument();
});
it('hides the previous child while loading another identity and ignores its late response', async () => {
  let finish!: (value:typeof identity)=>void;
  api.fetchPlayerIdentity.mockReturnValueOnce(new Promise(resolve => { finish=resolve; })).mockRejectedValueOnce(new Error('Unavailable with current access'));
  const view=render(<RosterPlayerIdentity playerId={23} onSaved={vi.fn()} />);
  view.rerender(<RosterPlayerIdentity playerId={24} onSaved={vi.fn()} />);
  await screen.findByRole('alert');
  await act(async()=>finish(identity));
  expect(screen.queryByText('Canonical child')).not.toBeInTheDocument(); expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
