import { useState } from 'react';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import { operationDescriptions, operationModule } from './workspaceNavigation';

// A tool has one home. Shortcuts are personal links, never a permission source.
export const workspaceAreas = [
  { id: 'football', label: 'Football', description: 'Squads, training and player development.', tabs: ['admissions', 'squads', 'attendance', 'development', 'restrictions', 'preparation', 'player-cards'] },
  { id: 'people', label: 'People', description: 'Players, staff, permissions and care.', tabs: ['players', 'my-people', 'role-requests', 'personnel', 'staff-duties', 'credentials', 'specialists', 'guardians', 'registration', 'education', 'medical', 'welfare', 'departures', 'invites'] },
  { id: 'operations', label: 'Club operations', description: 'Facilities, travel and equipment.', tabs: ['travel', 'equipment', 'facilities'] },
  { id: 'recruitment', label: 'Recruitment', description: 'Applications, tryouts and agent approaches.', tabs: ['applications', 'tryouts', 'club-approaches', 'jobs'] },
  { id: 'business', label: 'Club business', description: 'Finances, the club shop and campaigns.', tabs: ['finance', 'store', 'campaigns'] },
  { id: 'settings', label: 'Settings', description: 'Club setup, ownership and your responsibilities.', tabs: ['my-role', 'workspace-settings', 'settings', 'roles'] },
] as const;
export const areaFor = (tab: string) => workspaceAreas.find(area => (area.tabs as readonly string[]).includes(tab));
export function toolDescription(tab: TabItem) {
  return operationDescriptions[operationModule(tab.id) ?? ''] ?? ({
    'my-squads': 'Open a squad, find its players and prepare for training.', squads: 'Your players, training sessions and squad responsibilities.',
    'my-people': 'Find players in your assigned squads.', players: 'Manage club affiliations, trialists and player status.',
    'role-requests': 'Assign staff roles and review requested changes.', personnel: 'Coaches, specialists, referees and management access.',
    'my-role': 'See your approved responsibilities or request a change.', roles: 'Manage ownership and club membership.',
    settings: 'Edit the club profile and joining policy.', overview: 'Club totals, applications and the wider schedule.',
    'club-approaches': 'Review player-approved approaches from agents.', jobs: 'Post openings and review applicants.',
    admissions: 'Arrange introductions, agree a place and complete group enrollment.', applications: 'Review earlier club and staff applications.', tryouts: 'Organise tryouts and review players.',
    store: 'Manage your public merchandise catalogue.', campaigns: 'Manage fundraising and sponsorship campaigns.',
    'player-cards': 'Edit football profiles and player information.', invites: 'Invite people to join the club.',
  } as Partial<Record<WorkspaceTab,string>>)[tab.id] ?? tab.label;
}
export function useWorkspaceShortcuts(club:number,user:number|null,tabs:TabItem[]) {
  const key=`gk-club-shortcuts-v1:${club}:${user}`;
  const [saved,setSaved]=useState<string[]|null>(()=>{try {const v=JSON.parse(localStorage.getItem(key)??'null');return Array.isArray(v)?v.filter(x=>typeof x==='string'):null;}catch{return null;}});
  const ids=[...new Set((saved??[]).map(id=>id==='my-squads'?'squads':id))].filter(id=>tabs.some(t=>t.id===id)&&!['overview','my-day','tools'].includes(id)).slice(0,6);
  const save=(next:string[])=>{setSaved(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Navigation also works without preference storage. */}};
  const toggle=(tab:WorkspaceTab)=>{if(!tabs.some(t=>t.id===tab)||['overview','my-day','tools'].includes(tab))return;save(ids.includes(tab)?ids.filter(id=>id!==tab):ids.length<6?[...ids,tab]:ids);};
  const move=(id:string,direction:-1|1)=>{const index=ids.indexOf(id),next=[...ids],target=index+direction;if(index<0||target<0||target>=ids.length)return;[next[index],next[target]]=[next[target],next[index]];save(next);};
  return {ids,toggle,move};
}

export function canonicalWorkspaceTab(tab:WorkspaceTab|null):WorkspaceTab|null {
  return tab==='my-day'?'overview':tab==='my-squads'?'squads':tab;
}
