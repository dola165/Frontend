import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubHero } from './ClubHero';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
const auth = vi.hoisted(() => ({status:'authenticated',user:{role:'COACH',navigationCapabilities:{version:1,workspaces:[]} as NavigationCapabilities}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../ui/ImageCropperModal',()=>({ImageCropperModal:()=>null}));
const programme = {id:22,name:'U12',published:true};
const club = {id:1,name:'Dinamo',isMember:false,isStaffMember:false,presentation:{programmes:[programme]}} as ClubProfile;
const props = {club,canEditClubAssets:false,canManageClub:false,canOpenCalendar:false,canChallengeClub:false,canMessageClub:true,
    onFollowToggle:vi.fn(),onOpenManageClub:vi.fn(),onOpenCalendar:vi.fn(),onOpenChallengeModal:vi.fn(),onOpenMessage:vi.fn(),onRefresh:vi.fn()};
beforeEach(()=>{auth.status='authenticated';auth.user.role='COACH';auth.user.navigationCapabilities={version:1,workspaces:[]};});
const view = (profile:Partial<ClubProfile>={},extra:Partial<React.ComponentProps<typeof ClubHero>>={}) => render(<MemoryRouter><ClubHero {...props} club={{...club,...profile}} {...extra}/></MemoryRouter>);
it.each([{isMember:true},{isStaffMember:true},{myRole:'OWNER'},{playerAffiliationStatus:'ACTIVE'},{playerAffiliationStatus:'TRIALIST'},{relationshipState:'ACTIVE'},{relationshipState:'TRIALIST'}] as Partial<ClubProfile>[])('hides discovery for the current club relationship %j',profile=>{
    view(profile);expect(screen.queryByRole('link',{name:'Find training'})).not.toBeInTheDocument();
});
it.each(['club.workspace','club.operations','club.member','club.player','club.agent'])('hides discovery for a current-club %s connection',id=>{
    auth.user.navigationCapabilities.workspaces=[{id,context:{type:'club',id:1,label:'Dinamo'}}];
    view();expect(screen.queryByRole('link',{name:'Find training'})).not.toBeInTheDocument();
});
it('keeps discovery for a family connection so another child can find training',()=>{
    auth.user.navigationCapabilities.workspaces=[{id:'club.family',context:{type:'club',id:1,label:'Dinamo'}}];
    view();expect(screen.getByRole('link',{name:'Find training'})).toHaveAttribute('href','/clubs/1?tab=teams');
});
it('uses the resolved own-club role while keeping management actions',()=>{
    view({}, {membershipRole:'OWNER',canManageClub:true,canOpenCalendar:true});
    expect(screen.queryByRole('link',{name:'Find training'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Schedule'})).toBeVisible();expect(screen.getByRole('button',{name:'Club settings'})).toBeVisible();
});
it.each(['COACH','PARENT','REFEREE','FAN'])('keeps discovery for a visiting %s regardless of identity or other-club membership',role=>{
    auth.user.role=role;auth.user.navigationCapabilities.workspaces=[{id:'club.workspace',context:{type:'club',id:120,label:'Riverside'}}];
    view({isFollowedByMe:true});expect(screen.getByRole('link',{name:'Find training'})).toHaveAttribute('href','/clubs/1?tab=teams');
});
it.each(['INVITED','APPLIED'] as const)('keeps discovery for %s before membership takes effect',relationshipState=>{
    view({relationshipState}, {canOpenWorkspace:true});
    expect(screen.getByRole('link',{name:'Find training'})).toBeVisible();
});
it('keeps discovery available to anonymous visitors',()=>{
    auth.status='anonymous';view();expect(screen.getByRole('link',{name:'Find training'})).toBeVisible();
});
it('does not flash discovery while the account is being resolved',()=>{
    auth.status='bootstrapping';view();expect(screen.queryByRole('link',{name:'Find training'})).not.toBeInTheDocument();
});
it('requires a currently published training programme',()=>{
    view({presentation:{...club.presentation!,programmes:[{...club.presentation!.programmes[0],published:false}]}});
    expect(screen.queryByRole('link',{name:'Find training'})).not.toBeInTheDocument();
});
