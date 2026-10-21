import { clone, passengers, players } from './model';
import type { Activity, Place, Plan, Store } from './model';
const source='Scenario supplier record · 10 Jun 2027 · Demo';
export const places: Place[] = [
  {id:'lodge',name:'North Coast Team Lodge',type:'stay',coords:[24.831,59.487],region:'Tallinn',description:'A quiet team base on the north coast. Four nights, one squad, space to recover.',conditions:['Meals arranged onsite','Twin rooms · room allocation private','Team meeting room included'],capacity:28,age:'All ages',availability:'Confirmed in baseline',minutes:25,price:352000,source},
  {id:'harbour',name:'Harbour Group Stay',type:'stay',coords:[24.711,59.454],region:'Tallinn',description:'A lower-cost city base. The headline saving needs a closer look at meals and transfers.',conditions:['No onsite meals · arrangement needed','Shared meeting space','Transfer estimate 35 min · supplier review needed'],capacity:24,age:'All ages',availability:'Available in fixture · unconfirmed',minutes:35,price:316800,source},
  {id:'forest-stay',name:'Forest Team House',type:'stay',coords:[24.647,59.397],region:'Tallinn',description:'Woodland accommodation with limited group space.',conditions:['Breakfast only','Capacity below the 22-person group','Accessibility details unknown'],capacity:16,age:'All ages',availability:'Capacity unsuitable',minutes:45,price:281600,source},
  {id:'training',name:'Pinefield Training Ground',type:'ground',coords:[24.86,59.464],region:'Tallinn',description:'The camp’s training base. A full-size synthetic pitch with changing space.',conditions:['Full-size 11-a-side · synthetic surface','Changing rooms included','Session slots reserved in baseline'],capacity:30,age:'U16',availability:'Confirmed in baseline',minutes:15,source},
  {id:'host',name:'East Bay Academy',type:'academy',coords:[24.921,59.461],region:'Tallinn',description:'First friendly host. U16 squad, 11-a-side, two 40-minute halves.',conditions:['U16 opponent · 11-a-side','45-minute pre-match arrival','Changing rooms included'],capacity:30,age:'U16',availability:'Confirmed in baseline',minutes:25,source},
  {id:'new-ground',name:'Ridge Park Match Ground',type:'ground',coords:[25.103,59.353],region:'Tallinn',description:'The proposed replacement ground for Wednesday’s friendly, further from the camp base.',conditions:['11-a-side · grass surface','45-minute pre-match arrival','65-minute transfer estimate · approximate'],capacity:30,age:'U16',availability:'Proposed host revision',minutes:65,source:'Host update version 2 · Demo'},
  {id:'second-host',name:'Westfield Youth Academy',type:'academy',coords:[24.642,59.421],region:'Tallinn',description:'Thursday’s U16 friendly and a shared technical review with the host staff.',conditions:['U16 opponent · 11-a-side','Two 40-minute halves','Changing facilities included'],capacity:30,age:'U16',availability:'Confirmed in baseline',minutes:40,source},
  {id:'junior',name:'Greenhill Junior Academy',type:'academy',coords:[24.784,59.389],region:'Tallinn',description:'A nearby host with a younger squad.',conditions:['U14 squad · outside selected age band','No U16 opponent recorded','Availability unknown'],capacity:26,age:'U14',availability:'Age band unsuitable',minutes:30,source},
  {id:'closed-ground',name:'Lakeside Community Pitch',type:'ground',coords:[24.785,59.413],region:'Tallinn',description:'A convenient alternative with a conflicting fixture booking.',conditions:['Grass · 11-a-side','Unavailable 16 Jun, 08:00–12:00','Changing rooms unknown'],capacity:30,age:'U16',availability:'Unavailable 16 Jun morning',minutes:20,source},
  {id:'airport',name:'Tallinn arrival meeting point',type:'meeting',coords:[24.799,59.414],region:'Tallinn',description:'Illustrative airport group meeting point. Look for the travel coordinator after arrivals.',conditions:['22-person group check','Synthetic travel schedule · no valid ticket','Local coach transfer arranged'],capacity:30,age:'All ages',availability:'Confirmed in baseline',minutes:35,source},
  {id:'harbour-point',name:'Baltic Team Transport meeting point',type:'meeting',coords:[24.77,59.447],region:'Tallinn',description:'An illustrative city coach collection point for group transfers.',conditions:['24-seat coach in fixture','Accessible boarding details unknown','No actual supplier request'],capacity:24,age:'All ages',availability:'Supplier confirmation needed',minutes:30,source},
  {id:'recovery',name:'Coastal Recovery Field',type:'ground',coords:[24.871,59.502],region:'Tallinn',description:'A light recovery-session candidate close to the team base.',conditions:['Small-sided grass space','Changing room details unknown','Availability not yet supplied'],capacity:24,age:'U16',availability:'Unknown · ask supplier',minutes:12,source},
  {id:'home',name:'Academy meeting point',type:'meeting',coords:[44.789,41.738],region:'Tbilisi',description:'Illustrative academy collection point for the local friendly.',conditions:['Meet with player care lead','Bring boots and water','Return collection at the same point'],capacity:30,age:'U16',availability:'Confirmed in baseline',minutes:0,source},
  {id:'local-ground',name:'Riverbank Friendly Ground',type:'ground',coords:[44.85,41.777],region:'Tbilisi',description:'A fictional local away-match ground. One afternoon, one simple team plan.',conditions:['U16 · 11-a-side · grass','Changing rooms included','25-minute transfer estimate'],capacity:30,age:'U16',availability:'Confirmed in baseline',minutes:25,source},
];
export const placeById = (id:string) => places.find(p=>p.id===id)!;
const activity=(id:string,day:string,start:string,end:string,title:string,kind:Activity['kind'],placeId:string,owner:string,note='',extra:Partial<Activity>={}):Activity=>({id,day,start,end,title,kind,placeId,owner,note,arrangement:'confirmed',...extra});
const campActivities:Activity[]=[
  activity('arrival','2027-06-14','12:30','13:00','Arrival & group check','meeting','airport','travel','Illustrative journey: Tbilisi departure 09:00 Asia/Tbilisi; Tallinn arrival 12:30 Europe/Tallinn. Synthetic schedule, no flight service or ticket.'),
  activity('arrival-transfer','2027-06-14','13:15','13:50','Transfer to team base','travel','lodge','travel','Illustrative coach journey',{journeyFrom:'airport',estimate:35,buffer:15}),
  activity('checkin','2027-06-14','14:00','15:00','Settle into camp','stay','lodge','care','Four nights · 22 people · private room allocations'),
  activity('orientation','2027-06-14','16:00','17:00','Light session & orientation','training','training','coach','Recovery after travel · low intensity'),
  activity('dinner1','2027-06-14','18:00','19:00','Team dinner','meal','lodge','care','Onsite meal arrangement'),
  activity('session2','2027-06-15','09:30','11:00','Technical foundations','training','training','coach','Possession under pressure · 11-a-side'),
  activity('lunch2','2027-06-15','12:00','13:00','Lunch & recovery','meal','lodge','care'),
  activity('session2b','2027-06-15','15:00','16:30','Team shape & transitions','training','training','assistant','75-minute recovery buffer after lunch'),
  activity('dinner2','2027-06-15','18:00','19:00','Team dinner','meal','lodge','care'),
  activity('training3','2027-06-16','10:00','11:00','Pre-match training','training','training','coach','Activation · set pieces · manage load'),
  activity('transfer3','2027-06-16','12:30','12:55','Transfer to friendly','travel','host','travel','Departure includes preparation time',{journeyFrom:'training',estimate:25,buffer:15}),
  activity('warmup3','2027-06-16','13:15','14:00','Arrival & warm-up','training','host','assistant','45 minutes before kickoff'),
  activity('match3','2027-06-16','14:00','15:30','Friendly · East Bay U16','match','host','coach','11-a-side · 2 × 40 min · substitutions agreed'),
  activity('recovery3','2027-06-16','16:00','17:00','Recovery & team review','stay','lodge','care','Return estimate 25 min · recovery meal'),
  activity('dinner3','2027-06-16','18:00','19:00','Team dinner','meal','lodge','care'),
  activity('recovery4','2027-06-17','09:30','10:30','Mobility & recovery','training','training','care','Low intensity before the second friendly'),
  activity('transfer4','2027-06-17','13:30','14:10','Transfer to Westfield','travel','second-host','travel','Approximate geometry and timing',{journeyFrom:'lodge',estimate:40,buffer:15}),
  activity('warmup4','2027-06-17','14:15','15:00','Arrival & warm-up','training','second-host','assistant','45-minute arrival requirement'),
  activity('match4','2027-06-17','15:00','16:30','Friendly · Westfield U16','match','second-host','coach','11-a-side · 2 × 40 min'),
  activity('dinner4','2027-06-17','18:00','19:00','Closing dinner','meal','lodge','care'),
  activity('checkout','2027-06-18','09:00','10:00','Breakfast & check-out','stay','lodge','care','Equipment and room check'),
  activity('return','2027-06-18','10:15','10:50','Return airport transfer','travel','airport','travel','Illustrative onward departure 13:00 Europe/Tallinn; collection 18:30 Asia/Tbilisi. No valid ticket.',{journeyFrom:'lodge',estimate:35,buffer:15}),
];
export function createPlan(id:string,name:string,squad:string,start:string,end:string,region:Plan['region'],activities:Activity[]=[],baseline=false):Plan {
  const local=region==='Tbilisi';
  const draft={activities:clone(activities),accommodation:baseline&&!local?'lodge':'',hotelDecision:baseline?'confirmed' as const:'pending' as const,mealsResolved:baseline,extraTransport:0};
  const published=baseline?{version:1,revision:1,draft:clone(draft),at:'2027-06-10T09:00:00Z',summary:'Original itinerary published. Essential arrangements confirmed in simulation.',permissionVersion:1}:null;
  return { id,name,squad,start,end,region,timezone:local?'Asia/Tbilisi':'Europe/Tallinn',revision:1,draft,published,publications:published?[clone(published)]:[],approval:{amount:baseline?(local?50000:1200000):0,decision:baseline?'confirmed':'pending',version:1},supplier:{decision:baseline?'confirmed':'pending',version:1},incoming:null,proposal:null,
    families:players.map(p=>({childId:p.id,acknowledgedVersion:baseline?1:0,permissions:baseline?[{version:1,status:'granted',actor:p.guardian,at:'2027-06-10T10:00:00Z'}]:[]})),
    boarding:Object.fromEntries(passengers.map(p=>[p.id,'expected'])),saved:local?['local-ground']:['lodge','harbour'],history:baseline?[{id:'baseline',text:'Itinerary v1 published; 18 guardian travel permissions recorded.',actor:'fixture',at:'2027-06-10T10:00:00Z'}]:[],undo:[],equipmentOwner:'',progress:'planning',clock:'2027-06-11T09:00:00Z',milestone:null,contribution:0,
    baseCosts:baseline?(local?[{category:'Local transport',cents:30000,committed:30000,paid:10000},{category:'Friendly arrangement',cents:10000,committed:10000,paid:0}]:[
      {category:'International travel',cents:300000,committed:300000,paid:300000},
      {category:'Local transport',cents:180000,committed:180000,paid:45000},
      {category:'Meals',cents:176000,committed:176000,paid:0},
      {category:'Training facilities',cents:60000,committed:60000,paid:0},
      {category:'Friendly arrangements',cents:60000,committed:60000,paid:0},
      {category:'Contingency allowance',cents:40000,committed:0,paid:0},
    ]):[],
  };
}
export function initialStore():Store {
  const camp=createPlan('camp','U16 Estonia camp','U16 academy','2027-06-14','2027-06-18','Tallinn',campActivities,true);
  const local=createPlan('local','Local away friendly','U16 academy','2027-06-12','2027-06-12','Tbilisi',[
    activity('local-meet','2027-06-12','13:00','13:05','Academy group check','meeting','home','care','Meet at the academy · boots and water · 10-minute preparation buffer after check-in'),
    activity('local-transfer','2027-06-12','13:15','13:40','Coach to Riverbank','travel','local-ground','travel','25-minute estimate',{journeyFrom:'home',estimate:25,buffer:10}),
    activity('local-warmup','2027-06-12','13:45','14:30','Arrival & warm-up','training','local-ground','assistant'),
    activity('local-match','2027-06-12','14:30','16:00','Away friendly · U16','match','local-ground','coach','11-a-side · 2 × 40 min'),
    activity('local-return','2027-06-12','16:15','16:40','Return & collection','travel','home','care','Collection 16:45 at academy',{journeyFrom:'local-ground',estimate:25,buffer:5}),
  ],true);
  return {schema:1,activeId:'camp',plans:{camp,local}};
}
