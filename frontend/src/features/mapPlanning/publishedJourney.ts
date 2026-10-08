import type { FamilyPlan,PlanPlace,FamilyLocation } from './api';
export function journeyPlaces(p:FamilyPlan):PlanPlace[]{
 const places:PlanPlace[]=[];
 const add=(key:string,location:FamilyLocation)=>{if(!places.some(p=>p.key===key))places.push({...location,key,type:'MANUAL',notes:''});};
 Object.entries(p.itinerary.locations||{}).forEach(([role,place])=>add(`plan:${role}`,place));
 p.itinerary.activities.forEach((a,i)=>{if(a.place&&!places.some(p=>p.latitude===a.place!.latitude&&p.longitude===a.place!.longitude))add(`published:${p.plan_id}:${i}`,a.place);});
 return places;
}
