import { workspaceLinks, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { accessibleClubs } from './clubAccess';

export type ConnectedWorkspace = { key:string; path:string; label:string; description:string; group:'Clubs'|'Personal work'|'Organizations'|'Venues'|'Tournaments'|'Teams'; actions?:{label:string;path:string}[] };
const personal: Record<string, Pick<ConnectedWorkspace,'label'|'description'|'actions'>> = {
  'referee.workspace': {label:'Referee workspace',description:'Your invitations, match preparation, reports and availability across clubs.',actions:[{label:'My assignments',path:'/referees/me#invitations'},{label:'Find matches',path:'/referees/me#open-requests'},{label:'Availability',path:'/referees/me#availability'}]},
  'parent.hub': {label:'Parent Hub',description:'Your children, family permissions and shared team activities.'},
  'agent.hub': {label:'Agent Hub',description:'Your representation, player portfolio and club engagements.'},
  'club.work': {label:'My club appointments',description:'Review invitations, accepted appointments and the access agreed with each club.'},
  'admin.console': {label:'Administration',description:'The platform tools available to your account.'},
};

/** Navigation only. Every destination continues to enforce its own current authority. */
export function connectedWorkspaces(caps?:NavigationCapabilities):ConnectedWorkspace[] {
  const result:ConnectedWorkspace[]=accessibleClubs(caps).map(club=>({key:`club:${club.id}`,path:`/clubs/${club.id}${club.canOpenWorkspace?'/workspace':''}`,label:club.name,description:club.relationships.join(' · '),group:'Clubs'}));
  const contexts=caps?.workspaces??[];
  if(contexts.some(item=>item.id==='club.family')&&!contexts.some(item=>item.id==='parent.hub'))result.push({key:'family:parent',path:'/parent',...personal['parent.hub'],group:'Personal work'});
  for(const link of workspaceLinks(caps)) {
    if(link.capability.startsWith('club.') && link.capability!=='club.work')continue;
    if(['organization.settings','organization.create','tournament.create'].includes(link.capability))continue;
    const item=contexts.find(c=>`${c.id}:${c.context.type}:${c.context.id}`===link.key);
    if(!item)continue;
    if(personal[link.capability])result.push({...link,...personal[link.capability],group:'Personal work'});
    else if(link.capability==='organization.workspace')result.push({...link,label:item.context.label,description:'Organization activities, people and administration.',group:'Organizations'});
    else if(link.capability==='venue.workspace')result.push({...link,label:item.context.label,description:'Venue bookings, availability and operating work.',group:'Venues'});
    else if(link.capability==='tournament.workspace')result.push({...link,label:item.context.label,description:'Your assigned competition work, fixtures and decisions.',group:'Tournaments'});
    else if(link.capability==='squad.workspace')result.push({...link,label:item.context.label,description:'The team activities shared with you.',group:'Teams'});
  }
  return result.filter((item,index,all)=>all.findIndex(other=>other.path===item.path)===index);
}
