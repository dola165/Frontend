import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ConnectedWork, WorkspacesPage, WorkspaceConnectionBar } from './ConnectedWork';
import { connectedWorkspaces } from './connectedWorkspaces';
import { footballActivities } from './footballActivities';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
const auth=vi.hoisted(()=>({user:{id:7,navigationCapabilities:{version:1,workspaces:[]} as NavigationCapabilities}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('./workspaceBriefing',()=>({useWorkspaceBriefing:()=>({loading:false,requests:{items:[],counts:{actionable:0,outgoing:0},unavailableSources:[]},requestsFailed:false,events:[],scheduleFailed:[],now:new Date()}),eventWhen:()=>''}));
const cap=(id:string,type='user',context=7,label=id)=>({id,context:{type,id:context,label}});
const full:NavigationCapabilities={version:1,workspaces:[cap('club.operations','club',121,'Grasskickz chveni'),cap('club.member','club',121,'Grasskickz chveni'),cap('club.family','club',1,'Dinamo'),cap('club.agent','club',2,'Agent club'),cap('referee.workspace'),cap('parent.hub'),cap('agent.hub'),cap('organization.workspace','organization',30,'Organizer'),cap('venue.workspace','organization',31,'Venue'),cap('tournament.workspace','tournament',40,'Cup'),cap('squad.workspace','squad',10,'Family team')]};

it('keeps staff, family, agent, organizer, venue and tournament destinations together without elevating club access',()=>{
 const work=connectedWorkspaces(full);
 expect(work.filter(w=>w.group==='Clubs').map(w=>w.path).sort()).toEqual(['/clubs/121/workspace','/clubs/2']);
 expect(work.map(w=>w.path)).toEqual(expect.arrayContaining(['/parent','/agent','/referees/me','/organizations/30/workspace','/stadiums/31/manage','/tournaments/40/workspace','/squads/10']));
 expect(footballActivities(full).map(w=>w.id)).toEqual(expect.arrayContaining(['my-club','parent-hub','referees','agent-hub','my-venues','my-organizations']));
});

it.each(['club.member','club.player','club.agent'])('%s opens the club profile without inventing a staff workspace',kind=>{
 expect(connectedWorkspaces({version:1,workspaces:[cap(kind,'club',1,'Dinamo')]}).map(w=>w.path)).toEqual(['/clubs/1']);
});

it('lets Tamar reach her assignments and availability from the club overview',()=>{
 auth.user.navigationCapabilities=full;
 render(<MemoryRouter><ConnectedWork clubId={121}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'My assignments'})).toHaveAttribute('href','/referees/me#invitations');
 expect(screen.getByRole('link',{name:'Availability'})).toHaveAttribute('href','/referees/me#availability');
 expect(screen.getByRole('link',{name:'Parent Hub'})).toBeVisible();
 expect(screen.getByRole('link',{name:'Agent Hub'})).toBeVisible();
});

it('offers a return to the club from personal work and removes revoked connections on refresh',()=>{
 auth.user.navigationCapabilities={version:1,workspaces:[cap('referee.workspace'),cap('club.operations','club',121,'Grasskickz chveni')]};
 const view=render(<MemoryRouter initialEntries={['/referees/me']}><WorkspaceConnectionBar/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Grasskickz chveni'})).toHaveAttribute('href','/clubs/121/workspace');
 auth.user.navigationCapabilities={version:1,workspaces:[cap('referee.workspace')]};
 view.rerender(<MemoryRouter initialEntries={['/referees/me']}><WorkspaceConnectionBar/></MemoryRouter>);
 expect(screen.queryByRole('link',{name:'Grasskickz chveni'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'All my workspaces'})).toBeVisible();
});

it('presents every authorized destination once and keeps a useful fan entry',()=>{
 auth.user.navigationCapabilities=full;
 const view=render(<MemoryRouter><WorkspacesPage/></MemoryRouter>);
 expect(within(screen.getByRole('region',{name:'Clubs'})).getAllByRole('link')).toHaveLength(2);
 expect(screen.getByRole('link',{name:/^Cup /})).toHaveAttribute('href','/tournaments/40/workspace');
 auth.user={id:8,navigationCapabilities:{version:1,workspaces:[]}};
 view.rerender(<MemoryRouter><WorkspacesPage/></MemoryRouter>);
 expect(screen.queryByText('Grasskickz chveni')).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Clubs I follow'})).toBeVisible();
});
