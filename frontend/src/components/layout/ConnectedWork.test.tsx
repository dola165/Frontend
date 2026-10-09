import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ConnectedWork } from './ConnectedWork';
import { connectedWorkspaces } from './connectedWorkspaces';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
const auth=vi.hoisted(()=>({user:{id:7,navigationCapabilities:{version:1,workspaces:[]} as NavigationCapabilities}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
const cap=(id:string,type='user',context=7,label=id)=>({id,context:{type,id:context,label}});
const full:NavigationCapabilities={version:1,workspaces:[cap('club.operations','club',121,'Grasskickz chveni'),cap('club.member','club',121,'Grasskickz chveni'),cap('club.family','club',1,'Dinamo'),cap('club.agent','club',2,'Agent club'),cap('referee.workspace'),cap('parent.hub'),cap('agent.hub'),cap('organization.workspace','organization',30,'Organizer'),cap('venue.workspace','organization',31,'Venue'),cap('tournament.workspace','tournament',40,'Cup'),cap('squad.workspace','squad',10,'Family team')]};

it('keeps staff, family, agent, organizer, venue and tournament destinations together without elevating club access',()=>{
 const work=connectedWorkspaces(full);
 expect(work.filter(w=>w.group==='Clubs').map(w=>w.path).sort()).toEqual(['/clubs/121/workspace','/clubs/2']);
 expect(work.map(w=>w.path)).toEqual(expect.arrayContaining(['/parent','/agent','/referees/me','/organizations/30/workspace','/stadiums/31/manage','/tournaments/40/workspace','/squads/10']));
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
