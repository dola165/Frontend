import { expect, it } from 'vitest';
import { staffMatchesSquad, enquiryPriority, type PublicStaff } from './publicJourney';
const person:PublicStaff={userId:1,fullName:'Academy coach',role:'CLUB_STAFF',responsibilities:[{title:'Academy coach',specialisations:['HEAD_COACH'],squadId:11,squadName:'U12',squadIds:[11,12],squadNames:['U12','U16'],clubWide:false,startsOn:'2026-09-27',endsOn:null}]};
it('finds a published coach in every appointed team but excludes unrelated teams',()=>{
 expect(staffMatchesSquad(person,'11')).toBe(true);expect(staffMatchesSquad(person,'12')).toBe(true);expect(staffMatchesSquad(person,'13')).toBe(false);
 expect(enquiryPriority(person,[12])).toBe(0);expect(enquiryPriority(person,[13])).toBe(2);
});
it('retains explicit whole-club public responsibilities',()=>{
 expect(staffMatchesSquad({...person,responsibilities:[{...person.responsibilities[0],squadId:null,squadIds:[],clubWide:true}]},'13')).toBe(true);
});
