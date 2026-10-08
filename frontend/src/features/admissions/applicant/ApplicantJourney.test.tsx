import inquiryJson from './__fixtures__/inquiry.json?raw';
import offerJson from './__fixtures__/place_offered.json?raw';
import homeJson from './__fixtures__/home.json?raw';
import opportunitiesJson from './__fixtures__/opportunities.json?raw';
import introductionJson from './__fixtures__/introduction_assessment.json?raw';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdmissionCase, AdmissionHome, AdmissionInquiry, OpportunityPage, Participation } from '../types';
import { fetchAdmissionGroupSchedule, fetchAdmissionInquiry, commandAdmissionInquiry, submitAdmissionInquiry, claimAdmissionInvitation, commandAdmission, fetchAdmissionHome, fetchOpportunity, searchOpportunities, submitAdmission, updateAdmissionPlayerCard } from '../api';
import { OpportunityBrowsePage } from './OpportunityBrowsePage';
import { fetchPlayerIdentity, savePlayerIdentity } from '../../joining-contract/api';
import { OpportunityDetailPage } from './OpportunityDetailPage';
import { AdmissionHomePage } from './AdmissionHomePage';
import { OfferResponse, SessionResponse, PrimaryChangeResponse } from './CaseActions';
import { PlayerCardEditor } from './PlayerCardEditor';
import { AdmissionInvitationCard } from './AdmissionInvitationCard';
import { matchesOpportunity } from './mapMatching';
import { MapAdmissionControls } from './MapAdmissionControls';
import { GeneralAdmissionInquiryPage, GeneralInquiryForm, AdmissionInquiryPage } from './AdmissionInquiryPage';
import { AdmissionGroupSchedulePage } from './AdmissionGroupSchedulePage';
import { admissionMapQuery } from './discoveryQuery';
import { apiClient } from '../../../api/axiosConfig';
import { defaultMapFilters } from '../../../components/map/MapFilterSidebar';
import { buildLoginPath, getAuthFlow } from '../../../utils/authRedirect';
vi.mock('../../joining-contract/api',()=>({fetchPlayerIdentity:vi.fn(),savePlayerIdentity:vi.fn(),uploadPlayerPhoto:vi.fn()}));
const auth=vi.hoisted(()=>({user:{id:77},sessionId:'family-session',isAuthenticated:true,refreshNavigationCapabilities:vi.fn()}));
const language=vi.hoisted(()=>({ka:false}));
vi.mock('../../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../../utils/authStorage',()=>({getAuthSessionId:()=>auth.sessionId,isCurrentAuthSession:(id:string)=>id===auth.sessionId}));
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string,ka:string)=>language.ka?ka:en)}));
vi.mock('../../parents/AddChild',()=>({AddChild:()=>null}));
vi.mock('../api',()=>({fetchAdmissionHome:vi.fn(),fetchOpportunity:vi.fn(),searchOpportunities:vi.fn(),submitAdmission:vi.fn(),commandAdmission:vi.fn(),claimAdmissionInvitation:vi.fn(),updateAdmissionPlayerCard:vi.fn(),reportAdmissionGuardianReview:vi.fn(),fetchAdmissionGroupSchedule:vi.fn(),fetchAdmissionInquiry:vi.fn(),commandAdmissionInquiry:vi.fn(),submitAdmissionInquiry:vi.fn()}));
const fixture=<T,>(name:string)=>JSON.parse(({inquiry:inquiryJson,place_offered:offerJson,home:homeJson,opportunities:opportunitiesJson,introduction_assessment:introductionJson} as Record<string,string>)[name]) as T;
const base=()=>fixture<AdmissionCase>('place_offered');
const opportunity=()=>fixture<OpportunityPage>('opportunities').items[0];
const show=(node:React.ReactNode,path='/')=>render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();vi.mocked(fetchPlayerIdentity).mockResolvedValue({playerId:77,version:1,fullName:'Synthetic self',dateOfBirth:null,gender:null,photoUrl:null,positions:[],dominantFoot:null,heightCm:null,weightKg:null,canEdit:true,minor:false});vi.mocked(savePlayerIdentity).mockImplementation(async(id,body)=>({...body,playerId:id,version:2,canEdit:true,minor:false}));language.ka=false;auth.isAuthenticated=true;auth.sessionId='family-session';vi.mocked(fetchAdmissionHome).mockResolvedValue(fixture<AdmissionHome>('home'));vi.mocked(fetchOpportunity).mockResolvedValue(opportunity());vi.mocked(searchOpportunities).mockResolvedValue(fixture<OpportunityPage>('opportunities'));});
afterEach(cleanup);
describe('Applicant invariants',()=>{
    it('requires fresh competitive-decision consent when an offered agreement changes',async()=>{
        const c=base();c.actions=['CONFIRM_PRIMARY_CHANGE'];c.offer!.terms.affiliationEffect='PRIMARY_CHANGE';c.primaryAffiliation={clubId:2,clubName:'Current club'};const props={onChanged:vi.fn(),refresh:vi.fn()};const shown=show(<PrimaryChangeResponse admissionCase={c} {...props}/>);
        fireEvent.change(screen.getByLabelText('Reference for this explicit decision'),{target:{value:'Recorded explicit decision reference'}});fireEvent.click(screen.getByLabelText(/^I explicitly agree to change/));expect(screen.getByRole('button',{name:'Confirm the separate competitive move'})).toBeEnabled();
        shown.rerender(<MemoryRouter><PrimaryChangeResponse admissionCase={{...c,offer:{...c.offer!,version:c.offer!.version+1}}} {...props}/></MemoryRouter>);expect(screen.getByLabelText(/^I explicitly agree to change/)).not.toBeChecked();expect(screen.getByRole('button',{name:'Confirm the separate competitive move'})).toBeDisabled();expect(commandAdmission).not.toHaveBeenCalled();
    });
    it('allows guidance for the signed-in self before completing a football card',async()=>{
        vi.mocked(fetchAdmissionHome).mockResolvedValue({participants:[],cases:[],selfCardNeedsDetails:true});vi.mocked(submitAdmissionInquiry).mockResolvedValue(fixture<AdmissionInquiry>('inquiry'));const profile=vi.spyOn(apiClient,'get').mockResolvedValue({data:{profile:{displayName:'FC Dinamo Tbilisi Academy'}}});
        try{show(<Routes><Route path="/admissions/organizations/:organizationId/inquire" element={<GeneralAdmissionInquiryPage/>}/></Routes>,'/admissions/organizations/1/inquire');await screen.findByRole('option',{name:'Myself'});fireEvent.change(screen.getByLabelText('Player card'),{target:{value:'77'}});fireEvent.change(screen.getByLabelText('What would you like help finding?'),{target:{value:'I would like advice before choosing a football group.'}});fireEvent.click(screen.getByRole('button',{name:'Send general inquiry'}));await waitFor(()=>expect(submitAdmissionInquiry).toHaveBeenCalledWith(1,expect.objectContaining({playerId:77,message:'I would like advice before choosing a football group.'}),'family-session'));expect(updateAdmissionPlayerCard).not.toHaveBeenCalled();}finally{profile.mockRestore();}
    });
    it('sends a general inquiry with no chosen group or participation agreement',async()=>{
        vi.mocked(submitAdmissionInquiry).mockResolvedValue(fixture<AdmissionInquiry>('inquiry'));show(<GeneralInquiryForm organizationId={1} playerId={101} playerName="Synthetic child"/>);
        fireEvent.change(screen.getByLabelText('What would you like help finding?'),{target:{value:'Please suggest a beginner group with compatible sibling times.'}});fireEvent.click(screen.getByRole('button',{name:'Send general inquiry'}));
        await waitFor(()=>expect(submitAdmissionInquiry).toHaveBeenCalledWith(1,{requestId:expect.any(String),playerId:101,message:'Please suggest a beginner group with compatible sibling times.'},'family-session'));expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
    it('supports a genuinely general question without a player identity',async()=>{
        vi.mocked(submitAdmissionInquiry).mockResolvedValue({...fixture<AdmissionInquiry>('inquiry'),playerId:null,playerName:null});show(<GeneralInquiryForm organizationId={1} playerId={null} playerName="General question"/>);
        fireEvent.change(screen.getByLabelText('What would you like help finding?'),{target:{value:'Are beginner groups available?'}});fireEvent.click(screen.getByRole('button',{name:'Send general inquiry'}));await waitFor(()=>expect(submitAdmissionInquiry).toHaveBeenCalledWith(1,{requestId:expect.any(String),playerId:null,message:'Are beginner groups available?'},'family-session'));
    });
    it('explicitly associates one authorized child while preserving a general conversation',async()=>{
        const inquiry={...fixture<AdmissionInquiry>('inquiry'),playerId:null,playerName:null,conversationId:501,conversationDestination:'/messages?conversationId=501',actions:['ASSOCIATE_PLAYER' as const]};vi.mocked(fetchAdmissionInquiry).mockResolvedValue(inquiry);vi.mocked(commandAdmissionInquiry).mockResolvedValue({...inquiry,playerId:101,playerName:'Synthetic child',actions:[]});show(<Routes><Route path="/admissions/inquiries/:inquiryId" element={<AdmissionInquiryPage/>}/></Routes>,'/admissions/inquiries/1');
        fireEvent.click(await screen.findByText('Discuss a player or arrange a first visit'));fireEvent.change(await screen.findByLabelText('Player'),{target:{value:'101'}});fireEvent.click(screen.getByRole('button',{name:'Share selected player'}));await waitFor(()=>expect(commandAdmissionInquiry).toHaveBeenCalledWith(inquiry.id,expect.objectContaining({requestId:expect.any(String),action:'ASSOCIATE_PLAYER',expectedVersion:inquiry.version,playerId:101}),'family-session'));expect(screen.getByRole('link',{name:'Open club conversation'})).toHaveAttribute('href','/messages?conversationId=501');
    });
    it('keeps group guidance separate from consent and links the routed case',async()=>{
        vi.mocked(fetchAdmissionInquiry).mockResolvedValue({...fixture<AdmissionInquiry>('inquiry'),status:'ROUTED',caseId:42,actions:[]});show(<Routes><Route path="/admissions/inquiries/:inquiryId" element={<AdmissionInquiryPage/>}/></Routes>,'/admissions/inquiries/1');
        expect(await screen.findByRole('link',{name:'Review the proposed group'})).toHaveAttribute('href','/admissions/cases/42');expect(screen.getByText(/Routing this inquiry gives no consent/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:/accept|confirm enrollment/i})).not.toBeInTheDocument();
    });
    it('opens the authorized standalone arrangement without inventing dated occurrences',async()=>{
        const o=opportunity();vi.mocked(fetchAdmissionGroupSchedule).mockResolvedValue({groupId:1,playerId:101,groupName:'School training',location:o.location,schedule:'Thursday at 17:00',timezone:'Asia/Tbilisi',terms:o.terms,sessions:[]});show(<Routes><Route path="/admissions/groups/:groupId/schedule" element={<AdmissionGroupSchedulePage/>}/></Routes>,'/admissions/groups/1/schedule?playerId=101');
        expect(await screen.findByText(/Thursday at 17:00/)).toBeInTheDocument();expect(screen.getByText(/No individual occurrences have been recorded/)).toBeInTheDocument();expect(fetchAdmissionGroupSchedule).toHaveBeenCalledWith(1,101,'family-session',expect.any(AbortSignal));
    });
    it('uses declared player gender and year on the map without guessing from names',async()=>{
        const home=fixture<AdmissionHome>('home');home.participants[0].gender='FEMALE';vi.mocked(fetchAdmissionHome).mockResolvedValue(home);const selected=vi.fn();
        show(<MapAdmissionControls playerId={undefined} onPlayer={selected} includeWaitlist={false} onWaitlist={vi.fn()}/>);
        await screen.findByRole('option',{name:home.participants[0].name});fireEvent.change(screen.getByLabelText('Find a group for'),{target:{value:String(home.participants[0].id)}});
        const birth=home.participants[0].dateOfBirth;if(!birth)throw new Error('This recorded-player fixture requires a birth date');
        expect(selected).toHaveBeenCalledWith(home.participants[0].id,Number(birth.slice(0,4)),'FEMALE',home.participants[0].minor);
    });
    it('creates a minimum adult card without a photo or invented career',async()=>{
        vi.mocked(updateAdmissionPlayerCard).mockResolvedValue({id:77,name:'Adult beginner',dateOfBirth:'1990-01-01',minor:false,guardian:false,provenance:null});show(<PlayerCardEditor playerId={77} onChanged={vi.fn()}/>);
        fireEvent.change(await screen.findByLabelText('Full name'),{target:{value:'Adult beginner'}});fireEvent.change(screen.getByLabelText('Date of birth'),{target:{value:'1990-01-01'}});fireEvent.click(screen.getByRole('button',{name:'Save player card'}));
        await waitFor(()=>expect(savePlayerIdentity).toHaveBeenCalledWith(77,expect.objectContaining({requestId:expect.any(String),expectedVersion:1,fullName:'Adult beginner',dateOfBirth:'1990-01-01',gender:null,photoUrl:null,positions:[],heightCm:null,weightKg:null}),'family-session'));expect(screen.getByLabelText('Private player photo')).toBeInTheDocument();
    });
    it('claims an offline inquiry with the chosen authorized identity and invitation version',async()=>{
        const home=fixture<AdmissionHome>('home');vi.mocked(claimAdmissionInvitation).mockResolvedValue(base());show(<AdmissionInvitationCard invitation={{id:41,version:3,organizationId:1,organizationName:'Dinamo',groupId:1,groupName:'Beginner group',intendedPlayerId:101,message:'Agreed offline inquiry',expiresAt:'2026-10-11T00:00:00Z',status:'PENDING'}} participants={home.participants} onChanged={vi.fn()}/>);
        fireEvent.click(screen.getByLabelText('I confirm the named player and want to continue this recorded inquiry.'));fireEvent.click(screen.getByRole('button',{name:'Continue this inquiry'}));await waitFor(()=>expect(claimAdmissionInvitation).toHaveBeenCalledWith(41,expect.objectContaining({requestId:expect.any(String),expectedVersion:3,playerId:101,accept:true}),'family-session'));
    });
    it('searches one eligible opportunity with birth-year, gender and active/waitlist criteria',async()=>{
        show(<OpportunityBrowsePage/>);await screen.findByRole('option',{name:'Synthetic child · child'});
        fireEvent.change(screen.getByLabelText('Selected player'),{target:{value:'101'}});
        fireEvent.change(screen.getByLabelText('Gender category'),{target:{value:'MALE'}});
        fireEvent.click(screen.getByLabelText('Include waiting lists'));fireEvent.click(screen.getByRole('button',{name:'Show groups'}));
        await waitFor(()=>expect(searchOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({birthYear:2018,gender:'MALE',acceptingOnly:true,includeWaitlist:true,page:0}),expect.any(AbortSignal)));
    });
    it('keeps sibling cases separate when selecting a player',async()=>{
        const home=fixture<AdmissionHome>('home');home.participants.push({...home.participants[0],id:102,name:'Second child'});home.cases.push({...home.cases[0],id:200,playerId:102,playerName:'Second child',groupName:'Sibling group'});vi.mocked(fetchAdmissionHome).mockResolvedValue(home);
        show(<AdmissionHomePage/>);fireEvent.click(await screen.findByRole('button',{name:'Second child · 2018'}));expect(screen.getByRole('heading',{name:'Sibling group'})).toBeVisible();expect(screen.queryByRole('heading',{name:'Beginner group'})).not.toBeInTheDocument();expect(commandAdmission).not.toHaveBeenCalled();
    });
    it('accepts the exact named child, case and offer version while preserving another affiliation',async()=>{
        const c={...base(),primaryAffiliation:{clubId:99,clubName:'Current club'}};vi.mocked(commandAdmission).mockResolvedValue({...c,stage:'ENROLLED'});const changed=vi.fn();
        show(<OfferResponse admissionCase={c} offer={c.offer!} onChanged={changed} refresh={vi.fn()}/>);
        fireEvent.click(screen.getByLabelText(`I accept this named group and these terms for ${c.playerName}.`));fireEvent.click(screen.getByRole('button',{name:'Accept this place'}));
        await waitFor(()=>expect(commandAdmission).toHaveBeenCalledWith(c.id,expect.objectContaining({requestId:expect.any(String),action:'ACCEPT_OFFER',expectedVersion:c.version,offerId:c.offer!.id,offerVersion:c.offer!.version,acceptTerms:true}),'family-session'));
        expect(screen.getByText('Existing competitive affiliation stays unchanged')).toBeVisible();expect(changed).toHaveBeenCalledOnce();
    });
    it('replays an interrupted acceptance with its original request ID after remount',async()=>{
        const c=base();vi.mocked(commandAdmission).mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({...c,stage:'ENROLLED'});
        const first=show(<OfferResponse admissionCase={c} offer={c.offer!} onChanged={vi.fn()} refresh={vi.fn()}/>);
        fireEvent.click(screen.getByLabelText(`I accept this named group and these terms for ${c.playerName}.`));fireEvent.click(screen.getByRole('button',{name:'Accept this place'}));await screen.findByRole('alert');const original=vi.mocked(commandAdmission).mock.calls[0][1];first.unmount();
        show(<OfferResponse admissionCase={{...c,version:5}} offer={{...c.offer!,version:4}} onChanged={vi.fn()} refresh={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));
        await waitFor(()=>expect(commandAdmission).toHaveBeenCalledTimes(2));expect(vi.mocked(commandAdmission).mock.calls[1][1]).toEqual(original);
    });
    it('requires staff to resolve unknown fees instead of confirming an undisclosed charge',()=>{
        const c=base();show(<OfferResponse admissionCase={c} offer={{...c.offer!,terms:{...c.offer!.terms,feesKnown:false}}} onChanged={vi.fn()} refresh={vi.fn()}/>);fireEvent.click(screen.getByLabelText(`I accept this named group and these terms for ${c.playerName}.`));expect(screen.getByRole('button',{name:'Accept this place'})).toBeDisabled();expect(commandAdmission).not.toHaveBeenCalled();
    });
    it('requires fresh agreement after a material offer revision',()=>{
        const c=base();const view=show(<OfferResponse admissionCase={c} offer={c.offer!} onChanged={vi.fn()} refresh={vi.fn()}/>);fireEvent.click(screen.getByLabelText(`I accept this named group and these terms for ${c.playerName}.`));expect(screen.getByRole('button',{name:'Accept this place'})).toBeEnabled();
        view.rerender(<MemoryRouter><OfferResponse admissionCase={{...c,version:2}} offer={{...c.offer!,version:2,schedule:'New schedule'}} onChanged={vi.fn()} refresh={vi.fn()}/></MemoryRouter>);expect(screen.getByRole('button',{name:'Accept this place'})).toBeDisabled();expect(screen.getByLabelText(`I accept this named group and these terms for ${c.playerName}.`)).not.toBeChecked();
    });
    it('continues an existing same-intake arrangement instead of submitting another request',async()=>{
        const home=fixture<AdmissionHome>('home');show(<Routes><Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage/>}/></Routes>,'/admissions/opportunities/1?player=101');expect(await screen.findByRole('link',{name:'Open current arrangement'})).toHaveAttribute('href',`/admissions/cases/${home.cases[0].id}?player=101`);expect(screen.queryByRole('button',{name:'Request an introduction'})).not.toBeInTheDocument();expect(submitAdmission).not.toHaveBeenCalled();
    });
    it('changes the selected child without carrying forward a consent checkbox',async()=>{
        const home=fixture<AdmissionHome>('home');home.cases=[];home.participants.push({...home.participants[0],id:102,name:'Second child'});vi.mocked(fetchAdmissionHome).mockResolvedValue(home);const o={...opportunity(),method:'DIRECT' as const,availability:'PLACES_AVAILABLE' as const};vi.mocked(fetchOpportunity).mockResolvedValue(o);
        show(<Routes><Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage/>}/></Routes>,`/admissions/opportunities/${o.id}?player=101`);
        const accept=await screen.findByLabelText('I confirm these terms for Synthetic child.');fireEvent.click(accept);expect(accept).toBeChecked();fireEvent.change(screen.getByLabelText('Player card'),{target:{value:'102'}});
        expect(await screen.findByLabelText('I confirm these terms for Second child.')).not.toBeChecked();expect(submitAdmission).not.toHaveBeenCalled();
    });
    it('routes conditional siblings through review instead of committing one child immediately',async()=>{
        vi.mocked(fetchAdmissionHome).mockResolvedValue({...fixture<AdmissionHome>('home'),cases:[]});
        const o={...opportunity(),method:'DIRECT' as const,availability:'PLACES_AVAILABLE' as const};vi.mocked(fetchOpportunity).mockResolvedValue(o);vi.mocked(submitAdmission).mockResolvedValue(base());
        show(<Routes><Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage/>}/></Routes>,`/admissions/opportunities/${o.id}?player=101`);
        fireEvent.change(await screen.findByLabelText('Sibling or timing request (optional)'),{target:{value:'Only if both children can attend together'}});fireEvent.click(screen.getByRole('button',{name:'Request staff review'}));await waitFor(()=>expect(submitAdmission).toHaveBeenCalledWith(expect.objectContaining({playerId:101,intent:'REQUEST',siblingConstraint:'Only if both children can attend together',message:expect.stringContaining('Only if both children can attend together')}),'family-session'));expect(vi.mocked(submitAdmission).mock.calls[0][0].acceptTerms).toBeUndefined();
    });
    it('does not report enrollment when current guardian authority is rejected',async()=>{
        const c=base();const changed=vi.fn();const refresh=vi.fn();vi.mocked(commandAdmission).mockRejectedValue(Object.assign(new Error('Guardian was revoked'),{isAxiosError:true,response:{status:403,data:{message:'Guardian was revoked'}}}));
        show(<OfferResponse admissionCase={c} offer={c.offer!} onChanged={changed} refresh={refresh}/>);fireEvent.click(screen.getByLabelText(`I accept this named group and these terms for ${c.playerName}.`));fireEvent.click(screen.getByRole('button',{name:'Accept this place'}));await screen.findByRole('alert');expect(changed).not.toHaveBeenCalled();expect(refresh).toHaveBeenCalledOnce();
    });
    it('requests rescheduling as a case message without accepting a replacement session',async()=>{
        const c=fixture<AdmissionCase>('introduction_assessment');const s:Participation={id:123,version:2,status:'INVITED',emergencyContact:null,title:'Intro session',startsAt:'2026-10-05T13:00:00Z',endsAt:'2026-10-05T14:00:00Z',timezone:'Asia/Tbilisi',location:opportunity().location,contact:'Academy coach',preparation:'Training shoes',cost:'Free',capacity:3,responseDeadline:'2026-10-05T10:00:00Z',squadSessionId:1,noRegularPlaceGuaranteed:false};vi.mocked(commandAdmission).mockResolvedValue(c);
        show(<SessionResponse admissionCase={c} session={s} onChanged={vi.fn()} refresh={vi.fn()}/>);fireEvent.click(screen.getByText(`Request another date for ${s.title}`));fireEvent.change(screen.getByLabelText('Message to responsible staff'),{target:{value:'Could we attend Thursday instead?'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));
        await waitFor(()=>expect(commandAdmission).toHaveBeenCalledWith(c.id,expect.objectContaining({action:'MESSAGE',message:'Could we attend Thursday instead?'}),'family-session'));expect(vi.mocked(commandAdmission).mock.calls.some(call=>call[1].action==='CONFIRM_SESSION')).toBe(false);
    });
    it('preserves the opportunity destination through login',()=>{
        const link=buildLoginPath('/admissions/opportunities/321?player=101');expect(link).toContain('/login?next=');expect(getAuthFlow().nextPath).toBe('/admissions/opportunities/321?player=101');
    });
    it('renders the commitment controls in Georgian',()=>{
        language.ka=true;const c=base();show(<OfferResponse admissionCase={c} offer={c.offer!} onChanged={vi.fn()} refresh={vi.fn()}/>);expect(screen.getByRole('button',{name:'ამ ადგილის მიღება'})).toBeDisabled();expect(screen.getByLabelText(`ვიღებ ამ დასახელებულ ჯგუფსა და პირობებს: ${c.playerName}.`)).toBeInTheDocument();
    });
});
describe('Same opportunity discovery',()=>{
    it('queries the actual venue and organization metadata without headquarters correlation',()=>{
        const filters={...defaultMapFilters,clubs:{...defaultMapFilters.clubs,country:'GE',city:'Tbilisi',birthYear:2018,genders:['Girls' as const],categories:['SCHOOL_CLUB' as const],officialOnly:true,openTryoutsOnly:true}};
        expect(admissionMapQuery(filters,[41.7,44.8],null,'radius','beginner')).toMatchObject({latitude:41.7,longitude:44.8,radiusKm:filters.distanceKm,birthYear:2018,gender:'FEMALE',country:['GE'],city:['Tbilisi'],category:['SCHOOL_CLUB'],verifiedOnly:true,acceptingOnly:true});
        expect(admissionMapQuery(filters,[0,0],{west:170,east:-170,south:-20,north:20},'area','')).toMatchObject({minLat:-20,maxLat:20,minLng:170,maxLng:-170});
        expect(admissionMapQuery(filters,[0,0],null,'region','').radiusKm).toBeUndefined();
    });
    it('does not combine a boy age match from one group with available girls places in another',()=>{
        const o=opportunity();const f={...defaultMapFilters,clubs:{...defaultMapFilters.clubs,birthYear:2014,genders:['Boys' as const],openTryoutsOnly:true}};
        expect(matchesOpportunity({...o,birthYearFrom:2018,birthYearTo:2018,gender:'FEMALE',availability:'PLACES_AVAILABLE'},f)).toBe(false);
        expect(matchesOpportunity({...o,birthYearFrom:2014,birthYearTo:2014,gender:'MALE',availability:'CLOSED'},f)).toBe(false);
    });
    it('only includes waiting-only groups through explicit opt-in',()=>{
        const o={...opportunity(),availability:'WAITLIST' as const};const f={...defaultMapFilters,clubs:{...defaultMapFilters.clubs,openTryoutsOnly:true}};expect(matchesOpportunity(o,f)).toBe(false);expect(matchesOpportunity(o,{...f,clubs:{...f.clubs,includeWaitlist:true}})).toBe(true);
    });
    it('matches the published season cohort rather than the current birthday',()=>{
        const o={...opportunity(),referenceDate:'2026-09-01',birthYearFrom:2015,birthYearTo:2015};const f={...defaultMapFilters,clubs:{...defaultMapFilters.clubs,ageGroups:['U12']}};expect(matchesOpportunity(o,f)).toBe(true);expect(matchesOpportunity({...o,referenceDate:'2027-09-01'},f)).toBe(false);
    });
});
