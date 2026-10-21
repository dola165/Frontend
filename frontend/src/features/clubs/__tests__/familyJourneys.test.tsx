import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MessageText } from '../../../components/chat/MessageText';
import { SquadTrainingSchedule } from '../SquadTrainingSchedule';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
vi.mock('../../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),put:vi.fn()}}));
vi.mock('../../../context/AuthContext',()=>({useAuth:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();vi.mocked(useAuth).mockReturnValue({sessionId:null,status:'anonymous'} as ReturnType<typeof useAuth>);});
const frame=(node:React.ReactNode)=>render(<MemoryRouter>{node}</MemoryRouter>);
const base={squadId:9,squadName:'U12 Mixed',visibility:'PRIVATE',canManage:false,canView:false,revision:0,sessions:[],limited:false};
it('shows programme training times to a visiting parent without implying private locations are missing',async()=>{
 vi.mocked(apiClient.get).mockResolvedValue({data:{...base,canView:true,programmeTimesPublic:true,publicationConfigured:false,sessions:[{id:'time:0',title:'Training',startsAt:'2026-09-29T12:00:00Z',endsAt:'2026-09-29T13:30:00Z',status:'SCHEDULED',timesOnly:true,timezone:'Asia/Tbilisi'}]}});
 frame(<SquadTrainingSchedule clubId={1} squadId={9}/>);
 expect(await screen.findByText('Training times public')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'All dates'}));
 expect(screen.getByText(/Tuesday.*16:00–17:30/)).toBeVisible();
 expect(screen.queryByText(/Ask the club about training days/)).not.toBeInTheDocument();
 expect(screen.queryByText('Location to be confirmed')).not.toBeInTheDocument();
 expect(screen.getByText('Session details are shared with squad members.')).toBeVisible();
});
it('turns an existing enquiry into a programme card without inventing the sender’s intent',()=>{
 frame(<MessageText text={'Enquiry: U12 programme\nOur academy\nhttps://app.grasskickz.com/clubs/1?tab=teams&programme=22\n\nzd zd'}/>);
 expect(screen.getByText('Question about training')).toBeVisible();expect(screen.getByText('zd zd')).toBeVisible();
 expect(screen.getByRole('link',{name:/Public programme information/})).toHaveAttribute('href','/clubs/1?tab=teams&programme=22');
 expect(screen.queryByText('Arrange a first visit')).not.toBeInTheDocument();
});
it('shows explicit enquiry intent and optional age while escaping user text',()=>{
 frame(<MessageText text={'Enquiry: U12 programme\nOur academy\nhttps://app.grasskickz.com/clubs/1?tab=teams&programme=22\nReason: Arrange a first visit\nPlayer age: 10\n\n<img src=x> Could we visit Tuesday?'}/>);
 expect(screen.getByText('Arrange a first visit')).toBeVisible();expect(screen.getByText(/Player age 10/)).toBeVisible();expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('does not give an external or malformed link a club enquiry card',()=>{
 frame(<MessageText text={'Enquiry: U12\nOur academy\nhttps://app.grasskickz.com.evil.test/clubs/1?tab=teams&programme=22\n\nHello'}/>);
 expect(screen.queryByText('Training enquiry')).not.toBeInTheDocument();expect(screen.getByRole('link')).toHaveAttribute('rel','noopener noreferrer');
});
it('keeps a private timetable closed to visitors with an explicit member sign-in',async()=>{
 vi.mocked(apiClient.get).mockResolvedValue({data:base});frame(<SquadTrainingSchedule clubId={1} squadId={9}/>);
 expect(await screen.findByText('This timetable is shared with squad members')).toBeVisible();expect(screen.getByRole('link',{name:'Sign in'})).toHaveAttribute('href',expect.stringContaining('/login?'));expect(screen.queryByLabelText('Timetable visibility')).not.toBeInTheDocument();
});
it('previews real cancellations and requires explicit publication with the current revision',async()=>{
 vi.mocked(useAuth).mockReturnValue({sessionId:null,status:'authenticated'} as ReturnType<typeof useAuth>);
 vi.mocked(apiClient.get).mockResolvedValue({data:{...base,canManage:true,canView:true,revision:3,sessions:[{id:'session:1',title:'Weekly training',startsAt:'2026-09-28T14:00:00Z',endsAt:'2026-09-28T15:30:00Z',status:'CANCELLED',timezone:'Asia/Tbilisi',location:'Pitch 1'}]}});
 vi.mocked(apiClient.put).mockResolvedValue({data:{revision:4,visibility:'PUBLIC'}});frame(<SquadTrainingSchedule clubId={1} squadId={9}/>);
 await screen.findByText('Weekly training');expect(screen.getByText('Cancelled')).toBeVisible();expect(screen.queryByText('Pitch 1')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Timetable visibility'),{target:{value:'PUBLIC'}});expect(apiClient.put).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Publish training timetable'}));
 await waitFor(()=>expect(apiClient.put).toHaveBeenCalledWith('/clubs/1/squads/9/training-schedule/publication',{visibility:'PUBLIC',revision:3},{_authSessionId:null}));
});
it('clears the previous account’s timetable when the account changes',async()=>{
 vi.mocked(apiClient.get).mockResolvedValue({data:{...base,canView:true,sessions:[{id:'1',title:'Private session',startsAt:'2026-09-28T14:00:00Z',endsAt:'2026-09-28T15:30:00Z',status:'SCHEDULED'}]}});
 const v=frame(<SquadTrainingSchedule clubId={1} squadId={9}/>);await screen.findByText('Private session');
 vi.mocked(useAuth).mockReturnValue({sessionId:'new-account',status:'authenticated'} as ReturnType<typeof useAuth>);vi.mocked(apiClient.get).mockReturnValue(new Promise(()=>{}));v.rerender(<MemoryRouter><SquadTrainingSchedule clubId={1} squadId={9}/></MemoryRouter>);expect(screen.queryByText('Private session')).not.toBeInTheDocument();
});
