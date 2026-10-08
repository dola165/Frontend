import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { WorkspaceOperations } from './WorkspaceOperations';
import { RecordEditor } from './RecordEditor';
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
afterEach(cleanup);
function Location() { return <output>{useLocation().search}</output>; }
function list(value=boot, query='?tab=attendance') { return render(<MemoryRouter initialEntries={[query]}><WorkspaceOperations boot={value} module="ATTENDANCE" onRefresh={vi.fn()}/><Location/></MemoryRouter>); }

it('offers upcoming readable sessions in time order and opens the actual register with clean context', async () => {
  list(boot,'?tab=attendance&q=old&mine=true&state=open&from=overview');
  await screen.findByText('No matching records');
  const sessions=within(screen.getByRole('region',{name:'Scheduled sessions'}));
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
  await screen.findByText('Start your attendance & collection records');
  expect(screen.queryByRole('button',{name:'Add attendance and collection'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Get started'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Next training/})).toBeVisible();
});

it('keeps mandatory person and activity choices pending and includes them in the saved-record review', () => {
  render(<RecordEditor boot={boot} definition={definition} onSaved={vi.fn()} onCancel={vi.fn()}/>);
  expect(screen.getByText('Required details added').closest('li')).toHaveAttribute('data-complete','false');
  expect(screen.getByText('Event or training session selected').closest('li')).toHaveAttribute('data-complete','false');
  fireEvent.change(screen.getByRole('textbox',{name:'Title'}),{target:{value:'Giorgi · Next training'}});
  fireEvent.change(screen.getByLabelText('Person'),{target:{value:'7'}});
  fireEvent.click(screen.getByRole('button',{name:/Continue/}));
  fireEvent.change(screen.getByLabelText('Squad'),{target:{value:'2'}});
  expect(screen.getByText('Required details added').closest('li')).toHaveAttribute('data-complete','false');
  fireEvent.click(screen.getByRole('button',{name:'Details'}));
  fireEvent.change(screen.getByLabelText('Person'),{target:{value:'7'}});
  fireEvent.click(screen.getByRole('button',{name:/Continue/}));
  fireEvent.change(screen.getByLabelText('Training session'),{target:{value:'11'}});
  expect(screen.getByText('Event or training session selected').closest('li')).toHaveAttribute('data-complete','true');
  fireEvent.click(screen.getByRole('button',{name:/Continue/}));
  const review=screen.getByRole('heading',{name:'Review & save'}).closest('section')!;
  expect(within(review).getByText('Giorgi Beridze')).toBeVisible();
  expect(within(review).getByText('Next training')).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
});
