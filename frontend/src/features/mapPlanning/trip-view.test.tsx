import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JourneyExplorer} from './JourneyExplorer';
import {journeySteps,journeyGeometry,journeyBounds,draftItinerary} from './journeyModel';
import {emptyDraft,planGet,planPost,type FamilyItinerary,type FamilyPlan,type Plan,type PlanContext} from './api';
import MapPlanWorkspace from './MapPlanWorkspace';
import {MyJourneys} from './MyJourneys';
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),planGet:vi.fn(),planPost:vi.fn()}));
const place={name:'Academy',address:'Main gate',latitude:41.7,longitude:44.8};
const ground={...place,name:'Training ground',latitude:41.72};
const itinerary:FamilyItinerary={title:'Published journey',timezone:'Asia/Tbilisi',startsAt:'2026-10-11T05:00Z',endsAt:'2026-10-11T09:00Z',destination:ground.name,meetingPoint:place.name,collectionPoint:place.name,supervisionContact:'Coach Luka',message:'Bring water',locations:{meeting:place,destination:ground,collection:place},activities:[
 {title:'Training',kind:'TRAINING',startsAt:'2026-10-11T06:00Z',endsAt:'2026-10-11T07:00Z',place:ground},
 {title:'Meet the team',kind:'TRAVEL',startsAt:'2026-10-11T05:00Z',endsAt:'2026-10-11T05:15Z',place},
 {title:'Lunch',kind:'MEAL',startsAt:'2026-10-11T07:00Z',endsAt:'2026-10-11T08:00Z',place:ground},
 {title:'Return',kind:'TRAVEL',startsAt:'2026-10-11T08:30Z',endsAt:'2026-10-11T09:00Z',place}]};
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();});afterEach(cleanup);
it('orders real activities and numbers repeat visits without duplicating matching role stops',()=>{
 const steps=journeySteps(itinerary);expect(steps.map(s=>s.title)).toEqual(['Meet the team','Training','Lunch','Return']);expect(steps.map(s=>s.number)).toEqual([1,2,3,4]);
 const geometry=journeyGeometry(steps,steps[1].id);expect(geometry.pins.features).toHaveLength(2);expect(geometry.pins.features[1].properties.numbers).toBe('2·3');expect(geometry.pins.features[1].properties.active).toBe(true);expect(geometry.legs.features).toHaveLength(1);expect(geometry.legs.features[0].properties.number).toBe('1 → 2 / 3 → 4');
});
it('keeps unlocated activities visible and does not draw an invented connection through them',()=>{
 const steps=journeySteps({...itinerary,activities:itinerary.activities.map(a=>a.title==='Training'?{...a,place:null}:a)});expect(steps.find(s=>s.title==='Training')?.place).toBeNull();expect(journeyGeometry(steps,null).legs.features).toHaveLength(1);
});
it('selects the same stop from the list and timeline and shares it with the map',async()=>{
 const onMap=vi.fn();render(<JourneyExplorer itinerary={itinerary} journeyKey="trip:1" clubName="Dinamo" version={1} preview publication onMap={onMap}/>);
 fireEvent.click(within(screen.getByRole('navigation',{name:'Journey timeline'})).getByRole('button',{name:/2 Training/}));
 await waitFor(()=>expect(onMap.mock.lastCall?.[0].selected).toBe('activity:0'));expect(screen.getByRole('complementary',{name:'Selected journey stop'})).toHaveTextContent('Training ground');expect(within(screen.getByRole('complementary',{name:'Journey stops'})).getByRole('button',{name:/2 .*Training/})).toHaveAttribute('aria-current','step');
 fireEvent.click(within(screen.getByRole('complementary',{name:'Journey stops'})).getByRole('button',{name:/Lunch/}));await waitFor(()=>expect(onMap.mock.lastCall?.[0].selected).toBe('activity:2'));expect(screen.queryByRole('button',{name:"I'm going"})).toBeNull();expect(screen.queryByRole('button',{name:'Give travel permission'})).toBeNull();
});
it('tours the sequence at a bounded pace and returns to a whole journey overview',async()=>{
 const onMap=vi.fn();render(<JourneyExplorer itinerary={itinerary} journeyKey="trip:1" clubName="Dinamo" version={1} onMap={onMap}/>);fireEvent.click(screen.getByRole('button',{name:'Play journey'}));await waitFor(()=>expect(onMap.mock.lastCall?.[0].selected).toBe('activity:1'));fireEvent.click(screen.getByRole('button',{name:'Pause tour'}));fireEvent.click(screen.getAllByRole('button',{name:'Whole journey'})[0]);await waitFor(()=>expect(onMap.mock.lastCall?.[0].selected).toBeNull());
});
it('draft previews contain public place photos and exclude staff, participant and finance fields',()=>{
 const draft={...emptyDraft(),title:'Trip',privateNotes:'secret',places:[{...place,key:'ground',type:'MANUAL' as const,notes:'private place',photoUrl:'/uploads/photo.jpg'}],activities:[{key:'training',title:'Training',kind:'TRAINING' as const,startsAt:itinerary.startsAt,endsAt:itinerary.endsAt,placeKey:'ground',notes:'secret activity'}]};const view=draftItinerary(draft);expect(view.activities[0].place?.photoUrl).toBe('/uploads/photo.jpg');expect(JSON.stringify(view)).not.toContain('secret');expect(JSON.stringify(view)).not.toContain('private place');expect(view).not.toHaveProperty('participants');expect(view).not.toHaveProperty('budgetMinor');
});
it('coach view preserves draft edits and exact journey links do not automatically open Family plans',async()=>{
 const context:PlanContext={id:1,name:'Dinamo',settings:{timezone:'Asia/Tbilisi'},squads:[{id:2,name:'U16 Boys',canEdit:true}],participants:[],events:[],sessions:[]};
 const plan={id:7,club_id:1,squad_id:2,title:'Saved plan',revision:2,published_revision:1,published_version:1,draft:{...emptyDraft(context),title:'Private draft title'},published:itinerary,rights:{edit:true,travel:true,finance:false,publish:true,leadership:false},suppliers:{},totalMinor:0,budgetApproved:false,issues:[],history:[],familyResponses:[],trip:null,passengers:[],linkedSchedule:[]} as unknown as Plan;
 vi.mocked(planGet).mockImplementation(async path=>path==='/context'?[context]:path==='/7'?plan:[]);
 const {container}=render(<MemoryRouter initialEntries={['/map?plans=family&journey=7&plan=7']}><MapPlanWorkspace candidate={null} onCandidateUsed={()=>{}} onPlaces={()=>{}} onFocus={()=>{}} onExplore={()=>{}} onClose={()=>{}} onMapClick={()=>{}} onPickMode={()=>{}} onPreview={()=>{}} onLayout={()=>{}}/></MemoryRouter>);
 await screen.findByDisplayValue('Private draft title');expect(screen.queryByRole('dialog',{name:'Family plans window'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'View journey'}));await screen.findByRole('complementary',{name:'Journey stops'});expect(screen.getByRole('heading',{name:'Published journey',level:2})).toBeVisible();expect(container.querySelector('.mp-staff-surface')).toHaveAttribute('inert');expect(planPost).not.toHaveBeenCalled();
 fireEvent.click(within(container.querySelector('.mp-topbar') as HTMLElement).getByRole('button',{name:'Back to planning'}));expect(screen.getByDisplayValue('Private draft title')).toBeVisible();expect(planPost).not.toHaveBeenCalled();
});
it('keeps international connections and overview short across the date line',()=>{
 const points:[number,number][]=[[179,12],[-179,13]],bounds=journeyBounds(points);expect(bounds[1][0]-bounds[0][0]).toBe(2);const steps=journeySteps({...itinerary,locations:{},activities:itinerary.activities.slice(0,2).map((a,i)=>({...a,place:{...place,longitude:points[i][0],latitude:points[i][1]}}))});const line=journeyGeometry(steps,null).legs.features[0].geometry.coordinates;expect(Math.abs(line[1][0]-line[0][0])).toBe(2);
});
it('can preview an unfinished draft without losing the workspace to invalid dates',()=>{
 const draft={...emptyDraft(),startsAt:'',endsAt:'',places:[{...place,key:'plan:meeting',type:'MANUAL' as const,notes:''}]};expect(journeySteps(draftItinerary(draft))[0].day).toBe('Date to be confirmed');
});
const familyRow={id:20,plan_id:7,child_id:3,child_name:'Ana',club_name:'Dinamo',title:itinerary.title,version:1,viewer:'GUARDIAN',itinerary,published_at:itinerary.startsAt,travel:{status:'DRAFT'}} as unknown as FamilyPlan;
function Address(){return <output aria-label="Current address">{useLocation().search}</output>;}
it('keeps the selected child in the trip address when siblings share one journey',async()=>{
 vi.mocked(planGet).mockResolvedValue([familyRow,{...familyRow,id:21,child_id:4,child_name:'Nino'}]);render(<MemoryRouter initialEntries={['/map?plans=family&journey=7&journeyChild=4']}><MyJourneys workspace/><Address/></MemoryRouter>);const chooser=await screen.findByRole('combobox',{name:'Your journeys'});expect(chooser).toHaveTextContent('Nino');fireEvent.click(chooser);fireEvent.click(screen.getByRole('option',{name:/Ana/}));await waitFor(()=>expect(chooser).toHaveTextContent('Ana'));expect(screen.getByLabelText('Current address')).toHaveTextContent('journeyChild=3');
});
it('does not substitute another trip for an unavailable journey link',async()=>{
 vi.mocked(planGet).mockResolvedValue([familyRow]);render(<MemoryRouter initialEntries={['/map?plans=family&journey=999']}><MyJourneys workspace/></MemoryRouter>);await screen.findByText(/That journey is not available/);expect(screen.queryByRole('complementary',{name:'Journey stops'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:/Published journey/}));await screen.findByRole('complementary',{name:'Journey stops'});
});
it('uses plan identity rather than a colliding family recipient identity in map links',async()=>{
 const other={...familyRow,id:7,plan_id:11,title:'Different journey',itinerary:{...itinerary,title:'Different journey'},published_at:'2026-10-12T05:00Z'};
 vi.mocked(planGet).mockResolvedValue([other,familyRow]);render(<MemoryRouter initialEntries={['/map?plans=family&journey=7']}><MyJourneys workspace/></MemoryRouter>);await screen.findByRole('heading',{name:'Published journey',level:2});expect(screen.queryByRole('heading',{name:'Different journey'})).toBeNull();
});
