import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, setStoredAccessToken } from '../../utils/authStorage';
import { WorkspaceOperations } from './WorkspaceOperations';
import { RecordForm } from './records/RecordForm';
import type { Bootstrap, Definition } from './api';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('./SessionRegister', () => ({ SessionRegister: ({ session, squad }: { session: number; squad: number }) => <p>Register {session} · squad {squad}</p> }));
const definition: Definition = { module:'ATTENDANCE', kind:'ATTENDANCE', label:'Attendance and collection', states:['EXPECTED'], fields:[] };
const boot: Bootstrap = {
  clubId:1,clubName:'FC Dinamo Tbilisi Academy',actorId:1,leadership:false,definitions:[definition],specialisations:[],permissions:[],
  settings:{setting:'ACADEMY',playing_level:'GRASSROOTS',enabled_modules:['ATTENDANCE'],revision:0,timezone:'Asia/Tbilisi'},
  modules:[{id:'ATTENDANCE',writable:true,globalWrite:false,writeSquads:[2],globalRead:false,readSquads:[2]}],
  squads:[{id:2,name:'Under 12'},{id:3,name:'Under 16'}],people:[{id:7,name:'Giorgi Beridze'}],peopleBySquad:[{id:7,squad_id:2}],staff:[],guardians:[],venues:[],events:[],links:[],
  sessions:[
    {id:10,title:'Later training',starts_at:'2100-10-04T10:00:00Z',squad_id:2,squad_name:'Under 12'},
    {id:11,title:'Next training',starts_at:'2100-10-03T10:00:00Z',squad_id:2,squad_name:'Under 12'},
    {id:12,title:'Private other squad',starts_at:'2100-10-02T10:00:00Z',squad_id:3,squad_name:'Under 16'},
    {id:13,title:'Old training',starts_at:'2000-10-03T10:00:00Z',squad_id:2,squad_name:'Under 12'},
  ],
};
beforeEach(() => { vi.clearAllMocks();vi.mocked(apiClient.get).mockResolvedValue({data:[]}); });
afterEach(() => { cleanup(); localStorage.clear(); });
function Location() { return <output>{useLocation().search}</output>; }
function list(value=boot, query='?tab=attendance') { return render(<MemoryRouter initialEntries={[query]}><WorkspaceOperations boot={value} module="ATTENDANCE" onRefresh={vi.fn()}/><Location/></MemoryRouter>); }

it('offers upcoming readable sessions in time order and opens the actual register with clean context', async () => {
  list(boot,'?tab=attendance&q=old&mine=true&state=open&from=overview');
  await screen.findByText('No matching records');
  const sessions=within(screen.getByRole('region',{name:'Take a register'}));
  const buttons=sessions.getAllByRole('button');
  expect(buttons[0]).toHaveTextContent('Next training');
  expect(buttons[1]).toHaveTextContent('Later training');
  expect(sessions.queryByText('Private other squad')).not.toBeInTheDocument();
  expect(sessions.queryByText('Old training')).not.toBeInTheDocument();
  fireEvent.click(buttons[0]);
  await screen.findByText('Register 11 · squad 2');
  expect(screen.getByRole('status')).toHaveTextContent('?tab=attendance&from=overview&squad=2&session=11');
});

it('distinguishes a filtered empty result from an unused attendance workflow', async () => {
  list(boot,'?tab=attendance&squad=2');
  expect(await screen.findByText('No matching records')).toBeVisible();
  expect(screen.queryByRole('button',{name:'Get started'})).not.toBeInTheDocument();
  expect(screen.queryByText('Start your attendance & collection records')).not.toBeInTheDocument();
});

it('keeps read-only session access without offering record creation', async () => {
  list({...boot,modules:[{...boot.modules[0],writable:false,writeSquads:[]}]});
  await screen.findByText('No attendance & collection yet');
  expect(screen.queryByRole('button',{name:'Add attendance and collection'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Get started'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Next training/})).toBeVisible();
});

it('keeps mandatory person and activity choices required and saves them with the record', async () => {
  setStoredAccessToken('attendance-workspace-test-token');
  const sessionId = getAuthSessionId();
  expect(sessionId).not.toBeNull();
  vi.mocked(apiClient.post).mockResolvedValue({data:{id:5}});
  const saved=vi.fn().mockResolvedValue(undefined);
  render(<RecordForm boot={boot} definition={definition} backLabel="Back to attendance" onSaved={saved} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Title'}),{target:{value:'Giorgi · Next training'}});
  fireEvent.change(screen.getByLabelText('Squad'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Save attendance and collection'}));
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Person'),{target:{value:'7'}});
  fireEvent.change(screen.getByLabelText(/^Training session/),{target:{value:'11'}});
  fireEvent.click(screen.getByRole('button',{name:'Save attendance and collection'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
  expect(vi.mocked(apiClient.post).mock.calls).toStrictEqual([[
    '/clubs/1/operations/records',
    {kind:'ATTENDANCE',title:'Giorgi · Next training',subjectUserId:7,sessionId:11,squadId:2,assignedUserId:null,eventId:null,relatedRecordId:null,dueOn:null,data:{},revision:null},
    {_authSessionId:sessionId,headers:{'Idempotency-Key':expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)}},
  ]]);
});
