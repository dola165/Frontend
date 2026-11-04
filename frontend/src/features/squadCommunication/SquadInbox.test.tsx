import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SquadInboxConversation, SquadInboxList } from './SquadInbox';
import * as api from './api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'squad-inbox-fixture' }) }));
vi.mock('./api', () => ({ spaces: vi.fn(), overview: vi.fn(), messages: vi.fn(), markRead: vi.fn(), postMessage: vi.fn() }));
const room = { id: 171, name: 'Development U12', academy_name: 'Academy', viewer_id: 20, can_manage: false,
    threads: [{user_id:20,full_name:'Parent',unread_count:0}], coaches: [], players: [] } as unknown as api.SquadOverview;
const message = {id:8,author_id:4,author_name:'Coach',body:'Bring your boots',created_at:'2026-09-17T10:00:00Z'} as api.SquadMessage;
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.spaces).mockResolvedValue([room]);
    vi.mocked(api.overview).mockResolvedValue(room);
    vi.mocked(api.messages).mockResolvedValue([message]);
    vi.mocked(api.markRead).mockResolvedValue({} as never);
    vi.mocked(api.postMessage).mockResolvedValue({} as never);
});
it('makes group and coaching conversations discoverable in the global inbox', async () => {
    render(<MemoryRouter><SquadInboxList selected={null}/></MemoryRouter>);
    expect(await screen.findByRole('link',{name:'Squad chat'})).toHaveAttribute('href','/messages?squadId=171');
    expect(screen.getByRole('link',{name:'Message coach'})).toHaveAttribute('href','/messages?squadId=171&channel=coach');
});
it('reads and sends through the existing group history without creating a second conversation', async () => {
    render(<MemoryRouter initialEntries={['/messages?squadId=171']}><SquadInboxConversation id={171}/></MemoryRouter>);
    await screen.findByText('Bring your boots');
    expect(api.messages).toHaveBeenCalledWith(171,'CHAT',null,expect.any(AbortSignal),undefined,null);
    fireEvent.change(screen.getByPlaceholderText('Message the squad…'),{target:{value:'See you there'}});
    fireEvent.click(screen.getByRole('button',{name:'Send message'}));
    await waitFor(()=>expect(api.postMessage).toHaveBeenCalledWith(171,expect.objectContaining({kind:'CHAT',threadUserId:null,body:'See you there'})));
});
it('refuses a forged private thread without fetching somebody else or silently switching context', async () => {
    render(<MemoryRouter initialEntries={['/messages?squadId=171&channel=coach&thread=999']}><SquadInboxConversation id={171}/></MemoryRouter>);
    await screen.findByRole('alert');
    expect(api.messages).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Family or player')).not.toBeInTheDocument();
});
it('lets a parent read their own current private thread', async () => {
    render(<MemoryRouter initialEntries={['/messages?squadId=171&channel=coach&thread=20']}><SquadInboxConversation id={171}/></MemoryRouter>);
    await screen.findByText('Bring your boots');
    expect(api.messages).toHaveBeenCalledWith(171,'CHAT',20,expect.any(AbortSignal),undefined,null);
    expect(screen.queryByLabelText('Family or player')).not.toBeInTheDocument();
});
it('lets a coach choose a current family and rejects stale or forged thread selections', async () => {
    vi.mocked(api.overview).mockResolvedValue({...room,can_manage:true});
    render(<MemoryRouter initialEntries={['/messages?squadId=171&channel=coach&thread=999']}><SquadInboxConversation id={171}/></MemoryRouter>);
    const select=await screen.findByLabelText('Family or player');
    expect(api.messages).not.toHaveBeenCalled();
    fireEvent.change(select,{target:{value:'20'}});
    await screen.findByText('Bring your boots');
    expect(api.messages).toHaveBeenCalledWith(171,'CHAT',20,expect.any(AbortSignal),undefined,null);
});
it('shows access failures without exposing a composer or cached history', async () => {
    vi.mocked(api.overview).mockRejectedValue(new Error('Access removed'));
    render(<MemoryRouter><SquadInboxConversation id={171}/></MemoryRouter>);
    await screen.findByRole('alert');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(api.messages).not.toHaveBeenCalled();
});
it('keeps a parent in their teen’s private coach thread, where they read and write', async () => {
    vi.mocked(api.overview).mockResolvedValue({...room,child_threads:[{user_id:31,full_name:'Nino'}]});
    render(<MemoryRouter initialEntries={['/messages?squadId=171&channel=coach&thread=31']}><SquadInboxConversation id={171}/></MemoryRouter>);
    await screen.findByText('Bring your boots');
    expect(api.messages).toHaveBeenCalledWith(171,'CHAT',31,expect.any(AbortSignal),undefined,null);
    expect(screen.getByText(/You’re in this chat as this player’s parent/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('option',{name:'Nino with the coaches'})).toBeInTheDocument();
});
it('tells a teen and the coaches that the teen’s parents are in the thread', async () => {
    vi.mocked(api.overview).mockResolvedValue({...room,viewer_thread_guardians_can_view:true});
    render(<MemoryRouter initialEntries={['/messages?squadId=171&channel=coach']}><SquadInboxConversation id={171}/></MemoryRouter>);
    expect(await screen.findByText('This player, their parents and the coaches are in this chat.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message the coaches…')).toBeInTheDocument();
});
