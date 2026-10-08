import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubUpdates } from './ClubUpdates';
import { apiClient } from '../../api/axiosConfig';
const auth = vi.hoisted(() => ({ sessionId: 'one', status: 'authenticated' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const View = ({clubId = 1}:{clubId?:number}) => <MemoryRouter><ClubUpdates clubId={clubId} clubName="Dinamo"/></MemoryRouter>;
const announcement = { id: 8, title: 'Bring your training kit', body: 'Tuesday at six', author_name: 'Coach Luka', created_at: '2026-09-30T10:00:00Z', kind: 'ANNOUNCEMENT', thread_user_id: null };
beforeEach(() => { vi.resetAllMocks(); auth.sessionId = 'one'; auth.status = 'authenticated'; });
it('mixes public posts with permitted current-club announcements and excludes private threads', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).includes('/posts/') ? { posts: [{id: 9, content: 'Club news', authorName: 'Dinamo', createdAt: '2026-09-29T10:00:00Z'}] }
        : url === '/squad-communication' ? [{ id: 2, club_id: 1, name: 'U12' }, { id: 3, club_id: 99, name: 'Another club' }]
        : [announcement, {...announcement, id: 10, kind: 'CHAT', body: 'Private chat'}, {...announcement, id: 11, thread_user_id: 5, body: 'Private thread'}] }));
    render(<View/>);
    expect(await screen.findByText('Bring your training kit')).toBeVisible();
    expect(screen.getByText('Club news')).toBeVisible();
    expect(screen.queryByText('Private chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Private thread')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.get).mock.calls.some(([url]) => String(url).includes('/3/messages'))).toBe(false);
    expect(screen.getByRole('link', {name:/Bring your training kit/})).toHaveAttribute('href', '/squads/2?tab=announcements');
    expect(screen.getByRole('region', {name:'Club updates, scroll for more'})).toHaveAttribute('tabindex', '0');
});
it('never requests squad data for an anonymous viewer', async () => {
    auth.status = 'anonymous'; vi.mocked(apiClient.get).mockResolvedValue({data:{posts:[]}});
    render(<View/>); await screen.findByText('The next chapter starts here.');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', {name:'All posts'})).toHaveAttribute('href','/clubs/1?tab=posts');
});
it('immediately removes private updates when the session changes and ignores late responses', async () => {
    let finish:(value:unknown)=>void = () => {};
    vi.mocked(apiClient.get).mockImplementation(url => url === '/squad-communication' ? Promise.resolve({data:[{id:2,club_id:1,name:'U12'}]}) : String(url).includes('/messages') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({data:{posts:[]}}));
    const view = render(<View/>);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/squad-communication/2/messages?kind=ANNOUNCEMENT', expect.anything()));
    auth.sessionId = 'two'; auth.status = 'anonymous'; view.rerender(<View/>);
    await act(async () => finish({data:[announcement]}));
    expect(screen.queryByText('Bring your training kit')).not.toBeInTheDocument();
});
it('retains club posts when private announcements fail, without treating failure as no updates', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => { if (url === '/squad-communication') throw Error('offline'); return {data:{posts:[{id:9,content:'Still visible',createdAt:'2026-09-29T10:00:00Z'}]}}; });
    render(<View/>);
    expect(await screen.findByText('Still visible')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Some coach updates couldn’t be loaded');
    expect(screen.queryByText('The next chapter starts here.')).not.toBeInTheDocument();
});
it('removes old-club announcements immediately when navigating to another club', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => ({data: url === '/squad-communication' ? [{id:2,club_id:1,name:'U12'}] : String(url).includes('/messages') ? [announcement] : {posts:[]}}));
    const view = render(<View/>); await screen.findByText('Bring your training kit');
    view.rerender(<View clubId={99}/>);
    expect(screen.queryByText('Bring your training kit')).not.toBeInTheDocument();
    await screen.findByText('The next chapter starts here.');
});

it('composes the first carousel once both sources settle so late announcements cannot shift the initial scroll position', async () => {
    let finish:(value:unknown)=>void = () => {};
    vi.mocked(apiClient.get).mockImplementation(url => url === '/squad-communication' ? Promise.resolve({data:[{id:2,club_id:1,name:'U12'}]}) : String(url).includes('/messages') ? new Promise(resolve => {finish = resolve;}) : Promise.resolve({data:{posts:[{id:9,content:'Public story',createdAt:'2026-09-29T10:00:00Z'}]}}));
    render(<View/>);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/squad-communication/2/messages?kind=ANNOUNCEMENT', expect.anything()));
    expect(screen.queryByRole('region',{name:'Club updates, scroll for more'})).not.toBeInTheDocument();
    await act(async () => finish({data:[announcement]}));
    const links = screen.getByRole('region',{name:'Club updates, scroll for more'}).querySelectorAll('a');
    expect(links[0]).toHaveTextContent('Bring your training kit'); expect(links[1]).toHaveTextContent('Public story');
});

it('uses the edge buttons and focused rail keyboard without motion when reduced motion is requested', async () => {
    auth.status = 'anonymous';
    vi.mocked(apiClient.get).mockResolvedValue({data:{posts:[{id:9,content:'Club news',createdAt:'2026-09-29T10:00:00Z'}]}});
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true})));
    try {
        render(<View/>); await screen.findByText('Club news');
        const rail = screen.getByRole('region',{name:'Club updates, scroll for more'});
        Object.defineProperties(rail,{clientWidth:{value:320},scrollWidth:{value:1000},scrollLeft:{value:0,writable:true}});
        const scrollBy = vi.fn(); rail.scrollBy = scrollBy;
        vi.spyOn(rail.firstElementChild!, 'getBoundingClientRect').mockReturnValue({width:300} as DOMRect);
        fireEvent.scroll(rail);
        expect(screen.getByLabelText('Previous updates')).toBeDisabled();
        fireEvent.click(screen.getByRole('button',{name:'Next updates'}));
        expect(scrollBy).toHaveBeenLastCalledWith({left:316,behavior:'auto'});
        fireEvent.keyDown(rail,{key:'ArrowLeft'});
        expect(scrollBy).toHaveBeenLastCalledWith({left:-316,behavior:'auto'});
        fireEvent.keyDown(rail.firstElementChild!,{key:'ArrowRight'});
        expect(scrollBy).toHaveBeenCalledTimes(2);
        rail.scrollLeft = 680; fireEvent.scroll(rail);
        expect(screen.getByLabelText('Next updates')).toBeDisabled();
        expect(screen.getByRole('button',{name:'Previous updates'})).not.toBeDisabled();
    } finally { vi.unstubAllGlobals(); }
});
